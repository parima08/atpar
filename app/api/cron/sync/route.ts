import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { executeSyncForTeam } from '@/lib/sync';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { SyncDirection } from '@/lib/sync/sync-service';

/**
 * POST /api/cron/sync - Called by QStash on a schedule
 * Secured by QStash signature verification (no user auth needed)
 */
async function handler(request: Request) {
  try {
    const body = await request.json();
    const teamId = body.teamId;

    if (!teamId || typeof teamId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid teamId in request body' },
        { status: 400 }
      );
    }

    console.log(`[Cron Sync] Running scheduled sync for team ${teamId}`);

    // Look up the saved sync direction for this team (defaults to 'both')
    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
      columns: { syncDirection: true },
    });
    const direction: SyncDirection = (config?.syncDirection as SyncDirection) || 'both';

    const result = await executeSyncForTeam(teamId, {
      direction,
      dryRun: false,
    });

    console.log(`[Cron Sync] Completed for team ${teamId}: created=${result.result.created}, updated=${result.result.updated}, errors=${result.result.errorCount}`);

    return NextResponse.json({
      success: true,
      historyId: result.historyId,
      result: result.result,
    });
  } catch (error) {
    console.error('[Cron Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduled sync failed' },
      { status: 500 }
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
