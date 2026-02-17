import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getValidUserAdoToken } from '@/lib/ado/user-token';

interface AreaNode {
  id: number;
  name: string;
  path: string;
  hasChildren: boolean;
  children?: AreaNode[];
}

/**
 * GET /api/ado/areas?org=<orgName>&project=<projectName> - Fetches area paths
 * 
 * Returns a flat list of all area paths in the project
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

    // Fetch area paths from Azure DevOps (depth=10 for nested areas)
    const response = await fetch(
      `https://dev.azure.com/${encodeURIComponent(orgName)}/${encodeURIComponent(projectName)}/_apis/wit/classificationnodes/areas?$depth=10&api-version=7.0`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch ADO areas:', error);
      return NextResponse.json(
        { error: 'Failed to fetch area paths' },
        { status: response.status }
      );
    }

    const rootNode = await response.json();

    // Flatten the tree into a list of paths
    const areas: { id: number; path: string; name: string }[] = [];

    function flattenAreas(node: AreaNode, parentPath: string = '') {
      const fullPath = parentPath ? `${parentPath}\\${node.name}` : node.path || node.name;
      areas.push({
        id: node.id,
        path: fullPath,
        name: node.name,
      });

      if (node.children) {
        for (const child of node.children) {
          flattenAreas(child, fullPath);
        }
      }
    }

    flattenAreas(rootNode);

    return NextResponse.json({ areas });
  } catch (error) {
    console.error('Error fetching ADO areas:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
