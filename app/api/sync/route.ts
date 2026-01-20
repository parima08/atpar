import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs, syncHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { NotionClient, AdoClient, SyncService, type SyncConfig, type SyncDirection } from '@/lib/sync';

/**
 * POST /api/sync - Trigger a sync
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

    // Check environment variables
    const notionToken = process.env.NOTION_TOKEN;
    const adoPat = process.env.ADO_PAT;
    const adoOrgUrl = process.env.ADO_ORG_URL;

    if (!notionToken) {
      return NextResponse.json({ error: 'NOTION_TOKEN not configured' }, { status: 400 });
    }
    if (!adoPat) {
      return NextResponse.json({ error: 'ADO_PAT not configured' }, { status: 400 });
    }
    if (!adoOrgUrl) {
      return NextResponse.json({ error: 'ADO_ORG_URL not configured' }, { status: 400 });
    }

    // Get sync config from database
    const dbConfig = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    if (!dbConfig || !dbConfig.notionDatabaseId || !dbConfig.adoProject) {
      return NextResponse.json(
        { error: 'Sync configuration incomplete. Please configure Notion database and ADO project.' },
        { status: 400 }
      );
    }

    // Build SyncConfig from database config
    const syncConfig: SyncConfig = {
      statusMapping: (dbConfig.statusMapping as Record<string, string>) || {},
      reverseStatusMapping: (dbConfig.reverseStatusMapping as Record<string, string>) || {},
      assigneeMapping: (dbConfig.assigneeMapping as Record<string, string>) || {},
      reverseAssigneeMapping: (dbConfig.reverseAssigneeMapping as Record<string, string>) || {},
      defaultAdoState: dbConfig.defaultAdoState || 'New',
      defaultNotionStatus: dbConfig.defaultNotionStatus || 'Not started',
      notionAdoIdProperty: dbConfig.notionAdoIdProperty || 'ADO ID',
      notionPbiUrlProperty: dbConfig.notionPbiUrlProperty || 'PBI',
      notionStatusProperty: dbConfig.notionStatusProperty || 'Status',
      notionAssigneeProperty: dbConfig.notionAssigneeProperty || 'Assignee',
      notionDescriptionProperty: dbConfig.notionDescriptionProperty || 'Description',
      notionSubtaskProperty: dbConfig.notionSubtaskProperty || undefined,
      adoWorkType: dbConfig.adoWorkType || undefined,
      adoWorkTypeField: dbConfig.adoWorkTypeField || undefined,
      adoAreaPath: dbConfig.adoAreaPath || undefined,
    };

    // Create a sync history record
    const [historyRecord] = await db
      .insert(syncHistory)
      .values({
        teamId,
        direction,
        dryRun,
        status: 'running',
      })
      .returning();

    try {
      // Initialize clients
      const notionClient = new NotionClient(
        notionToken,
        dbConfig.notionDatabaseId,
        syncConfig
      );

      const adoClient = new AdoClient(
        adoOrgUrl,
        adoPat,
        dbConfig.adoProject,
        syncConfig
      );

      // Run sync
      const syncService = new SyncService(notionClient, adoClient, syncConfig);
      const result = await syncService.sync(limit, dryRun, direction);

      // Update history record with results
      await db
        .update(syncHistory)
        .set({
          created: result.created,
          updated: result.updated,
          updatedInNotion: result.updatedInNotion,
          skipped: result.skipped,
          errorCount: result.errors.length,
          errors: result.errors,
          logs: result.logs,
          status: result.errors.length > 0 ? 'completed' : 'completed',
          completedAt: new Date(),
        })
        .where(eq(syncHistory.id, historyRecord.id));

      return NextResponse.json({
        success: true,
        historyId: historyRecord.id,
        result: {
          created: result.created,
          updated: result.updated,
          updatedInNotion: result.updatedInNotion,
          skipped: result.skipped,
          errorCount: result.errors.length,
        },
        logs: result.logs,
      });
    } catch (syncError) {
      // Update history record with failure
      await db
        .update(syncHistory)
        .set({
          status: 'failed',
          errorCount: 1,
          errors: [{ notionId: '', title: 'Sync Error', error: String(syncError) }],
          completedAt: new Date(),
        })
        .where(eq(syncHistory.id, historyRecord.id));

      throw syncError;
    }
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
