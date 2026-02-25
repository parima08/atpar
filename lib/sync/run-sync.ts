/**
 * Shared sync execution logic used by both the manual sync API and the cron sync route
 */

import { db } from '@/lib/db/drizzle';
import { syncConfigs, syncHistory, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { canAccessApp } from '@/lib/db/trial';
import { NotionClient } from './notion-client';
import { AdoClient } from './ado-client';
import { SyncService } from './sync-service';
import { getValidAdoToken } from './ado-oauth';
import type { SyncConfig, SyncResult } from './types';
import type { SyncDirection, SyncItemDetail } from './sync-service';

export interface ExecuteSyncOptions {
  direction?: SyncDirection;
  dryRun?: boolean;
  limit?: number;
}

export interface ExecuteSyncResult {
  success: boolean;
  historyId: number;
  result: {
    created: number;
    updated: number;
    updatedInNotion: number;
    skipped: number;
    errorCount: number;
  };
  logs: string[];
  items: SyncItemDetail[];
}

/**
 * Execute a sync for a given team. Reusable by both the manual /api/sync route
 * and the QStash cron /api/cron/sync route.
 */
export async function executeSyncForTeam(
  teamId: number,
  options: ExecuteSyncOptions = {}
): Promise<ExecuteSyncResult> {
  const { direction = 'both', dryRun = false, limit } = options;

  // Check if team exists and has access
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!team) {
    throw new Error('Team not found');
  }

  if (!canAccessApp(team)) {
    throw new Error('Your trial has expired. Please upgrade to continue using atpar.');
  }

  // Get sync config from database
  const dbConfig = await db.query.syncConfigs.findFirst({
    where: eq(syncConfigs.teamId, teamId),
  });

  if (!dbConfig) {
    throw new Error('Sync configuration not found. Please configure your sync settings first.');
  }

  // Get credentials from database config
  const notionToken = dbConfig.notionToken;
  const adoOrgUrl = dbConfig.adoOrgUrl;
  const adoAuthType = dbConfig.adoAuthType || 'pat';

  if (!notionToken) {
    throw new Error('Notion token not configured. Please add your Notion integration token in Sync > Config.');
  }

  // Validate ADO credentials based on auth type
  let adoAccessToken: string | null = null;

  if (adoAuthType === 'oauth') {
    adoAccessToken = await getValidAdoToken(teamId);
    if (!adoAccessToken) {
      throw new Error('Azure DevOps OAuth token expired or invalid. Please reconnect your ADO account.');
    }
  } else {
    if (!dbConfig.adoPat) {
      throw new Error('ADO Personal Access Token not configured. Please add your ADO PAT in Sync > Config.');
    }
  }

  if (!adoOrgUrl) {
    throw new Error('ADO Organization URL not configured. Please add your ADO org URL in Sync > Config.');
  }

  const notionDatabaseIds = (dbConfig.notionDatabaseIds as string[]) || [];
  const notionDatabaseId = notionDatabaseIds[0];

  if (!notionDatabaseId || !dbConfig.adoProject) {
    throw new Error('Sync configuration incomplete. Please configure Notion database and ADO project in Sync > Config.');
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
  const historyRows = await db
    .insert(syncHistory)
    .values({
      teamId,
      direction,
      dryRun,
      status: 'running',
    })
    .returning();
  const historyRecord = historyRows[0];

  if (!historyRecord) {
    throw new Error('Failed to create sync history record');
  }

  try {
    // Initialize clients
    const notionClient = new NotionClient(
      notionToken,
      notionDatabaseId,
      syncConfig
    );

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
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(syncHistory.id, historyRecord.id));

    return {
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
    };
  } catch (syncError) {
    // Update history record with failure
    try {
      await db
        .update(syncHistory)
        .set({
          status: 'failed',
          errorCount: 1,
          errors: [{ notionId: '', title: 'Sync Error', error: String(syncError) }],
          completedAt: new Date(),
        })
        .where(eq(syncHistory.id, historyRecord.id));
    } catch (historyUpdateError) {
      console.error('Failed to update sync history on error:', historyUpdateError);
    }

    throw syncError;
  }
}
