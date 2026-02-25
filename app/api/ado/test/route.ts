import { NextRequest, NextResponse } from 'next/server';
import * as azdev from 'azure-devops-node-api';
import { getUser, getTeamIdForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/ado/test - Test Azure DevOps connection
 * Accepts credentials from request body for testing before save,
 * or falls back to team's stored credentials
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let adoPat = body.adoPat;
    let adoOrgUrl = body.adoOrgUrl;

    // If credentials not provided, try to get from team's stored config
    if (!adoPat || !adoOrgUrl) {
      const teamId = await getTeamIdForUser();
      if (!teamId) {
        return NextResponse.json({ success: false, message: 'Team not found' });
      }
      const config = await db.query.syncConfigs.findFirst({
        where: eq(syncConfigs.teamId, teamId),
      });
      
      if (!adoPat) adoPat = config?.adoPat;
      if (!adoOrgUrl) adoOrgUrl = config?.adoOrgUrl;
    }

    if (!adoPat) {
      return NextResponse.json({
        success: false,
        message: 'ADO Personal Access Token not provided',
      });
    }

    if (!adoOrgUrl) {
      return NextResponse.json({
        success: false,
        message: 'ADO Organization URL not provided',
      });
    }

    const authHandler = azdev.getPersonalAccessTokenHandler(adoPat);
    const connection = new azdev.WebApi(adoOrgUrl, authHandler);
    
    // Try to get core API to verify connection
    const coreApi = await connection.getCoreApi();
    const projects = await coreApi.getProjects();
    
    return NextResponse.json({
      success: true,
      message: `Connected to ${adoOrgUrl}`,
      projectCount: projects.length,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    console.error('ADO connection test failed:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to Azure DevOps',
    });
  }
}
