import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getValidUserAdoToken } from '@/lib/ado/user-token';

interface AdoProject {
  id: string;
  name: string;
  description?: string;
  state: string;
}

/**
 * GET /api/ado/projects?org=<orgName> - Fetches ADO projects for an organization
 * 
 * Requires the user to be authenticated with Microsoft OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgName = request.nextUrl.searchParams.get('org');
    if (!orgName) {
      return NextResponse.json(
        { error: 'Organization name is required' },
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

    // Fetch projects from Azure DevOps
    const response = await fetch(
      `https://dev.azure.com/${encodeURIComponent(orgName)}/_apis/projects?api-version=7.0`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch ADO projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const projects: AdoProject[] = data.value || [];

    // Transform to a simpler format, only include wellFormed projects
    const result = projects
      .filter((p) => p.state === 'wellFormed')
      .map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
      }));

    return NextResponse.json({ projects: result });
  } catch (error) {
    console.error('Error fetching ADO projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
