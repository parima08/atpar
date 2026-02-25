import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamIdForUser } from '@/lib/db/queries';
import { executeSyncForTeam } from '@/lib/sync';
import type { SyncDirection } from '@/lib/sync';

/**
 * POST /api/sync - Trigger a sync (manual, user-initiated)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const direction: SyncDirection = body.direction || 'both';
    const dryRun: boolean = body.dryRun || false;
    const limit: number | undefined = body.limit;

    const teamId = await getTeamIdForUser();
    if (!teamId) {
      return NextResponse.json({ error: 'Team not found' }, { status: 400 });
    }

    const result = await executeSyncForTeam(teamId, { direction, dryRun, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
