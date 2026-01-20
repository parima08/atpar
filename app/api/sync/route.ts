import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs, syncHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { NotionClient, AdoClient, SyncService, type SyncConfig, type SyncDirection, getValidAdoToken } from '@/lib/sync';

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

    // Get sync config from database (credentials are stored per-team)
    const dbConfig = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    if (!dbConfig) {
      return NextResponse.json(
        { error: 'Sync configuration not found. Please configure your sync settings first.' },
        { status: 400 }
      );
    }

    // Get credentials from database config
    const notionToken = dbConfig.notionToken;
    const adoOrgUrl = dbConfig.adoOrgUrl;
    const adoAuthType = dbConfig.adoAuthType || 'pat';

    if (!notionToken) {
      return NextResponse.json(
        { error: 'Notion token not configured. Please add your Notion integration token in Sync > Config.' },
        { status: 400 }
      );
    }

    // Validate ADO credentials based on auth type
    let adoAccessToken: string | null = null;
    
    if (adoAuthType === 'oauth') {
      adoAccessToken = await getValidAdoToken(teamId);
      if (!adoAccessToken) {
        return NextResponse.json(
          { error: 'Azure DevOps OAuth token expired or invalid. Please reconnect your ADO account.' },
          { status: 400 }
        );
      }
    } else {
      if (!dbConfig.adoPat) {
        return NextResponse.json(
          { error: 'ADO Personal Access Token not configured. Please add your ADO PAT in Sync > Config.' },
          { status: 400 }
        );
      }
    }

    if (!adoOrgUrl) {
      return NextResponse.json(
        { error: 'ADO Organization URL not configured. Please add your ADO org URL in Sync > Config.' },
        { status: 400 }
      );
    }

    // Get the first database ID for syncing (or use them all based on your needs)
    const notionDatabaseIds = (dbConfig.notionDatabaseIds as string[]) || [];
    const notionDatabaseId = notionDatabaseIds[0];

    if (!notionDatabaseId || !dbConfig.adoProject) {
      return NextResponse.json(
        { error: 'Sync configuration incomplete. Please configure Notion database and ADO project in Sync > Config.' },
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
        notionDatabaseId,
        syncConfig
      );

      // Initialize ADO client based on auth type
      const adoClient = new AdoClient({
        orgUrl: adoOrgUrl,
        project: dbConfig.adoProject,
        syncConfig,
        authType: adoAuthType as 'pat' | 'oauth',
        pat: dbConfig.adoPat || undefined,
        accessToken: adoAccessToken || undefined,
      });

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
        items: result.items,
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
