import { NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/config/env - Check which credentials are configured (from database)
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const team = await getTeamForUser();
    const teamId = team?.id ?? 1;

    // Check credentials from database config
    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    return NextResponse.json({
      notionToken: !!config?.notionToken,
      adoPat: !!config?.adoPat,
      adoOrgUrl: !!config?.adoOrgUrl,
      // Return the org URL (not secret) for display
      adoOrgUrlValue: config?.adoOrgUrl || '',
    });
  } catch (error) {
    console.error('Error checking config:', error);
    return NextResponse.json(
      { error: 'Failed to check configuration' },
      { status: 500 }
    );
  }
}
