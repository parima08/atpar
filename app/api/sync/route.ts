import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
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

    const body = await request.json();
    const direction: SyncDirection = body.direction || 'both';
    const dryRun: boolean = body.dryRun || false;
    const limit: number | undefined = body.limit;

    const teamId = 1; // For simplicity

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
