import { NextRequest, NextResponse } from 'next/server';
import * as azdev from 'azure-devops-node-api';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/ado/states?project=xxx - Get available states for Product Backlog Items
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = request.nextUrl.searchParams.get('project');
    if (!project) {
      return NextResponse.json(
        { error: 'project parameter required' },
        { status: 400 }
      );
    }

    const teamId = 1; // For simplicity
    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    const adoPat = config?.adoPat;
    const adoOrgUrl = config?.adoOrgUrl;

    if (!adoPat || !adoOrgUrl) {
      return NextResponse.json(
        { error: 'ADO credentials not configured. Please add them in Sync > Config.' },
        { status: 400 }
      );
    }

    const authHandler = azdev.getPersonalAccessTokenHandler(adoPat);
    const connection = new azdev.WebApi(adoOrgUrl, authHandler);
    const witApi = await connection.getWorkItemTrackingApi();
    
    // Get the Product Backlog Item work item type
    const workItemType = await witApi.getWorkItemType(project, 'Product Backlog Item');
    
    if (!workItemType.states) {
      return NextResponse.json({ states: [] });
    }

    return NextResponse.json({
      states: workItemType.states.map(s => ({
        name: s.name || '',
        category: s.category || '',
        color: s.color || '',
      })),
    });
  } catch (error) {
    console.error('Error fetching ADO states:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch states' },
      { status: 500 }
    );
  }
}
