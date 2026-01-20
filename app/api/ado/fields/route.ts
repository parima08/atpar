import { NextRequest, NextResponse } from 'next/server';
import * as azdev from 'azure-devops-node-api';
import { getUser } from '@/lib/db/queries';

/**
 * GET /api/ado/fields?project=xxx - Get work item fields for a project
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

    const adoPat = process.env.ADO_PAT;
    const adoOrgUrl = process.env.ADO_ORG_URL;

    if (!adoPat || !adoOrgUrl) {
      return NextResponse.json(
        { error: 'ADO_PAT and ADO_ORG_URL must be configured' },
        { status: 400 }
      );
    }

    const authHandler = azdev.getPersonalAccessTokenHandler(adoPat);
    const connection = new azdev.WebApi(adoOrgUrl, authHandler);
    const witApi = await connection.getWorkItemTrackingApi();
    
    const fields = await witApi.getFields(project);
    
    return NextResponse.json({
      fields: fields.map(f => ({
        name: f.name || '',
        referenceName: f.referenceName || '',
        type: f.type?.toString() || 'string',
        description: f.description || '',
      })),
    });
  } catch (error) {
    console.error('Error fetching ADO fields:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}
