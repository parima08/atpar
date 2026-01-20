import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncHistory } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

/**
 * GET /api/sync/history - Get sync history
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = 1; // For simplicity

    const history = await db.query.syncHistory.findMany({
      where: eq(syncHistory.teamId, teamId),
      orderBy: [desc(syncHistory.startedAt)],
      limit: 50,
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync history' },
      { status: 500 }
    );
  }
}
