import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getValidUserAdoToken } from '@/lib/ado/user-token';

interface AdoOrganization {
  accountId: string;
  accountUri: string;
  accountName: string;
}

/**
 * GET /api/ado/organizations - Fetches ADO organizations for the current user
 * 
 * Requires the user to be authenticated with Microsoft OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get valid ADO token (refreshes if needed)
    const accessToken = await getValidUserAdoToken(user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'ADO not connected. Please sign in with Microsoft.' },
        { status: 401 }
      );
    }

    // Fetch organizations from Azure DevOps
    const response = await fetch(
      'https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.0',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch ADO organizations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const organizations: AdoOrganization[] = data.value || [];

    // Transform to a simpler format
    const result = organizations.map((org) => ({
      id: org.accountId,
      name: org.accountName,
      url: `https://dev.azure.com/${org.accountName}`,
    }));

    return NextResponse.json({ organizations: result });
  } catch (error) {
    console.error('Error fetching ADO organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
