import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getValidUserAdoToken } from '@/lib/ado/user-token';

interface WorkItemType {
  name: string;
  description?: string;
  icon?: {
    url: string;
  };
  color?: string;
}

/**
 * GET /api/ado/work-item-types?org=<orgName>&project=<projectName>
 * 
 * Fetches available work item types for a project (e.g., Bug, Feature, User Story, Task)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgName = request.nextUrl.searchParams.get('org');
    const projectName = request.nextUrl.searchParams.get('project');

    if (!orgName || !projectName) {
      return NextResponse.json(
        { error: 'Organization and project are required' },
        { status: 400 }
      );
    }

    // Get valid ADO token
    const accessToken = await getValidUserAdoToken(user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'ADO not connected. Please sign in with Microsoft.' },
        { status: 401 }
      );
    }

    // Fetch work item types from Azure DevOps
    const response = await fetch(
      `https://dev.azure.com/${encodeURIComponent(orgName)}/${encodeURIComponent(projectName)}/_apis/wit/workitemtypes?api-version=7.0`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch ADO work item types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch work item types' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const types: WorkItemType[] = data.value || [];

    // Filter to only include common work item types (exclude system types)
    const commonTypes = ['Bug', 'Feature', 'User Story', 'Product Backlog Item', 'Task', 'Epic', 'Issue', 'Impediment'];
    
    const result = types
      .filter((type) => commonTypes.includes(type.name) || !type.name.startsWith('Microsoft.'))
      .map((type) => ({
        name: type.name,
        description: type.description,
        color: type.color,
      }));

    return NextResponse.json({ workItemTypes: result });
  } catch (error) {
    console.error('Error fetching ADO work item types:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
