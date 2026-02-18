import { NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { syncConfigs, syncHistory, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { canAccessApp } from '@/lib/db/trial';
import { NotionClient, AdoClient, type SyncConfig, type SyncDirection, getValidAdoToken } from '@/lib/sync';
import type { NotionItem, AdoWorkItem } from '@/lib/sync/types';

export interface StreamedSyncItem {
  id: string;
  title: string;
  status: string | null;
  adoId?: string | null;
  action: 'created' | 'updated' | 'updated_in_notion' | 'skipped' | 'error';
  actionDetail?: string;
}

export interface StreamedSyncMessage {
  type: 'item' | 'log' | 'progress' | 'complete' | 'error';
  item?: StreamedSyncItem;
  log?: string;
  progress?: { current: number; total: number; phase: string };
  result?: {
    created: number;
    updated: number;
    updatedInNotion: number;
    skipped: number;
    errorCount: number;
  };
  error?: string;
}

/**
 * POST /api/sync/stream - Trigger a sync with streaming updates
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: StreamedSyncMessage) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      };

      try {
        const user = await getUser();
        if (!user) {
          send({ type: 'error', error: 'Unauthorized' });
          controller.close();
          return;
        }

        const body = await request.json();
        const direction: SyncDirection = body.direction || 'both';
        const dryRun: boolean = body.dryRun || false;
        const limit: number | undefined = body.limit;

        // Check if team has access (active subscription or trial)
        const team = await getTeamForUser();

        if (!team) {
          send({ type: 'error', error: 'Team not found' });
          controller.close();
          return;
        }

        const teamId = team.id;

        if (!canAccessApp(team)) {
          send({ type: 'error', error: 'Your trial has expired. Please upgrade to continue using atpar.' });
          controller.close();
          return;
        }

        const dbConfig = await db.query.syncConfigs.findFirst({
          where: eq(syncConfigs.teamId, teamId),
        });

        if (!dbConfig) {
          send({ type: 'error', error: 'Sync configuration not found. Please configure your sync settings first.' });
          controller.close();
          return;
        }

        const notionToken = dbConfig.notionToken;
        const adoOrgUrl = dbConfig.adoOrgUrl;
        const adoAuthType = dbConfig.adoAuthType || 'pat';

        if (!notionToken) {
          send({ type: 'error', error: 'Missing Notion token. Please configure Notion settings.' });
          controller.close();
          return;
        }

        // Validate ADO credentials based on auth type
        let adoAccessToken: string | null = null;
        
        if (adoAuthType === 'oauth') {
          // Get valid OAuth token (will refresh if needed)
          adoAccessToken = await getValidAdoToken(teamId);
          if (!adoAccessToken) {
            send({ type: 'error', error: 'Azure DevOps OAuth token expired or invalid. Please reconnect your ADO account.' });
            controller.close();
            return;
          }
        } else {
          // PAT auth
          if (!dbConfig.adoPat || !adoOrgUrl) {
            send({ type: 'error', error: 'Missing ADO credentials. Please configure PAT and Organization URL.' });
            controller.close();
            return;
          }
        }

        if (!adoOrgUrl) {
          send({ type: 'error', error: 'Missing ADO Organization URL. Please configure your ADO settings.' });
          controller.close();
          return;
        }

        const notionDatabaseIds = (dbConfig.notionDatabaseIds as string[]) || [];
        const notionDatabaseId = notionDatabaseIds[0];

        if (!notionDatabaseId || !dbConfig.adoProject) {
          send({ type: 'error', error: 'Sync configuration incomplete. Please configure Notion database and ADO project.' });
          controller.close();
          return;
        }

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

        // Create history record
        const [historyRecord] = await db
          .insert(syncHistory)
          .values({ teamId, direction, dryRun, status: 'running' })
          .returning();

        // Initialize clients
        const notionClient = new NotionClient(notionToken, notionDatabaseId, syncConfig);
        
        // Initialize ADO client based on auth type
        const adoClient = new AdoClient({
          orgUrl: adoOrgUrl,
          project: dbConfig.adoProject,
          syncConfig,
          authType: adoAuthType as 'pat' | 'oauth',
          pat: dbConfig.adoPat || undefined,
          accessToken: adoAccessToken || undefined,
        });

        // Track results
        const result = {
          created: 0,
          updated: 0,
          updatedInNotion: 0,
          skipped: 0,
          errors: [] as Array<{ notionId: string; title: string; error: string }>,
        };
        const logs: string[] = [];

        const log = (msg: string) => {
          logs.push(msg);
          send({ type: 'log', log: msg });
        };

        // Helper to map status
        const mapStatus = (notionStatus: string | null): string => {
          if (!notionStatus) return syncConfig.defaultAdoState;
          const mapping = syncConfig.statusMapping;
          if (mapping[notionStatus]) return mapping[notionStatus];
          const lowerStatus = notionStatus.toLowerCase();
          for (const [key, value] of Object.entries(mapping)) {
            if (key.toLowerCase() === lowerStatus) return value;
          }
          return syncConfig.defaultAdoState;
        };

        const mapAdoStateToNotionStatus = (adoState: string | null): string => {
          if (!adoState) return syncConfig.defaultNotionStatus;
          const mapping = syncConfig.reverseStatusMapping;
          if (mapping[adoState]) return mapping[adoState];
          return syncConfig.defaultNotionStatus;
        };

        const mapAdoAssigneeToNotionEmail = (adoDisplayName: string | null): string | null => {
          if (!adoDisplayName) return null;
          const mapping = syncConfig.reverseAssigneeMapping;
          if (mapping[adoDisplayName]) return mapping[adoDisplayName];
          return null;
        };

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // === Notion → ADO Sync ===
        if (direction === 'both' || direction === 'notion-to-ado') {
          log('=== Notion → ADO Sync ===');
          send({ type: 'progress', progress: { current: 0, total: 0, phase: 'Fetching Notion items...' } });

          let notionItems = await notionClient.getAllItems();
          log(`Found ${notionItems.length} items in Notion database`);

          if (limit && limit > 0) {
            const itemsToSync = notionItems.filter(item => !item.adoId && !item.adoUrl);
            notionItems = itemsToSync.slice(0, limit);
            log(`Processing ${notionItems.length} item(s) due to limit`);
          }

          const total = notionItems.length;

          for (let i = 0; i < notionItems.length; i++) {
            const item = notionItems[i];
            send({ type: 'progress', progress: { current: i + 1, total, phase: 'Notion → ADO' } });

            try {
              const adoState = mapStatus(item.status);

              // Skip items with manual ADO links
              if (!item.adoId && item.adoUrl) {
                send({
                  type: 'item',
                  item: {
                    id: item.id,
                    title: item.title,
                    status: item.status,
                    action: 'skipped',
                    actionDetail: 'Has manual ADO link',
                  },
                });
                result.skipped++;
                await delay(100);
                continue;
              }

              if (!item.adoId) {
                // Create new PBI
                if (dryRun) {
                  send({
                    type: 'item',
                    item: {
                      id: item.id,
                      title: item.title,
                      status: item.status,
                      action: 'created',
                      actionDetail: `Would create in ADO with state: ${adoState}`,
                    },
                  });
                  result.created++;
                } else {
                  const pbi = await adoClient.createPBI(
                    item.title,
                    item.description,
                    adoState,
                    item.assignee,
                    item.id,
                    item.allFields
                  );
                  const adoUrl = adoClient.getWorkItemUrl(pbi.id);
                  await notionClient.updatePbiUrl(item.id, adoUrl);

                  send({
                    type: 'item',
                    item: {
                      id: item.id,
                      title: item.title,
                      status: item.status,
                      adoId: String(pbi.id),
                      action: 'created',
                      actionDetail: `Created ADO PBI #${pbi.id}`,
                    },
                  });
                  result.created++;
                }
              } else {
                // Update existing PBI
                const adoId = parseInt(item.adoId, 10);
                if (isNaN(adoId)) {
                  send({
                    type: 'item',
                    item: {
                      id: item.id,
                      title: item.title,
                      status: item.status,
                      adoId: item.adoId,
                      action: 'skipped',
                      actionDetail: `Invalid ADO ID: ${item.adoId}`,
                    },
                  });
                  result.skipped++;
                } else if (dryRun) {
                  send({
                    type: 'item',
                    item: {
                      id: item.id,
                      title: item.title,
                      status: item.status,
                      adoId: String(adoId),
                      action: 'skipped',
                      actionDetail: 'Dry run - would check for updates',
                    },
                  });
                  result.skipped++;
                } else {
                  const currentPbi = await adoClient.getWorkItem(adoId);
                  if (!currentPbi) {
                    send({
                      type: 'item',
                      item: {
                        id: item.id,
                        title: item.title,
                        status: item.status,
                        adoId: String(adoId),
                        action: 'skipped',
                        actionDetail: `ADO work item #${adoId} not found`,
                      },
                    });
                    result.skipped++;
                  } else if (currentPbi.state === adoState) {
                    send({
                      type: 'item',
                      item: {
                        id: item.id,
                        title: item.title,
                        status: item.status,
                        adoId: String(adoId),
                        action: 'skipped',
                        actionDetail: `No state change (ADO: ${currentPbi.state})`,
                      },
                    });
                    result.skipped++;
                  } else {
                    try {
                      await adoClient.updatePBI(adoId, adoState, item.assignee);
                      send({
                        type: 'item',
                        item: {
                          id: item.id,
                          title: item.title,
                          status: item.status,
                          adoId: String(adoId),
                          action: 'updated',
                          actionDetail: `Updated state: ${currentPbi.state} → ${adoState}`,
                        },
                      });
                      result.updated++;
                    } catch (updateError) {
                      const errorMsg = String(updateError);
                      if (errorMsg.includes('not in the list of supported values')) {
                        send({
                          type: 'item',
                          item: {
                            id: item.id,
                            title: item.title,
                            status: item.status,
                            adoId: String(adoId),
                            action: 'skipped',
                            actionDetail: `Cannot transition: ${currentPbi.state} → ${adoState}`,
                          },
                        });
                        result.skipped++;
                      } else {
                        throw updateError;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              send({
                type: 'item',
                item: {
                  id: item.id,
                  title: item.title,
                  status: item.status,
                  adoId: item.adoId,
                  action: 'error',
                  actionDetail: errorMessage,
                },
              });
              result.errors.push({ notionId: item.id, title: item.title, error: errorMessage });
            }

            await delay(350);
          }
        }

        // === ADO → Notion Sync ===
        if (direction === 'both' || direction === 'ado-to-notion') {
          log('=== ADO → Notion Sync ===');
          send({ type: 'progress', progress: { current: 0, total: 0, phase: 'Fetching ADO items...' } });

          const adoItems = await adoClient.getLinkedWorkItems();
          log(`Found ${adoItems.length} linked work items in ADO`);

          const total = adoItems.length;

          for (let i = 0; i < adoItems.length; i++) {
            const adoItem = adoItems[i];
            send({ type: 'progress', progress: { current: i + 1, total, phase: 'ADO → Notion' } });

            try {
              if (!adoItem.notionId) {
                send({
                  type: 'item',
                  item: {
                    id: `ado-${adoItem.id}`,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'skipped',
                    actionDetail: 'No Notion ID found',
                  },
                });
                result.skipped++;
                await delay(100);
                continue;
              }

              const notionItem = await notionClient.getItemById(adoItem.notionId);
              if (!notionItem) {
                send({
                  type: 'item',
                  item: {
                    id: adoItem.notionId,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'skipped',
                    actionDetail: 'Notion page not found',
                  },
                });
                result.skipped++;
                await delay(100);
                continue;
              }

              const adoChangedDate = adoItem.changedDate ? new Date(adoItem.changedDate) : null;
              const notionEditedDate = notionItem.lastEditedTime ? new Date(notionItem.lastEditedTime) : null;

              if (!adoChangedDate || !notionEditedDate || notionEditedDate >= adoChangedDate) {
                send({
                  type: 'item',
                  item: {
                    id: notionItem.id,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'skipped',
                    actionDetail: notionEditedDate && adoChangedDate && notionEditedDate >= adoChangedDate
                      ? 'Notion is newer'
                      : 'Cannot compare timestamps',
                  },
                });
                result.skipped++;
                await delay(100);
                continue;
              }

              // Check what changed
              const mappedNotionStatus = mapAdoStateToNotionStatus(adoItem.state);
              const statusChanged = mappedNotionStatus !== notionItem.status;
              const titleChanged = adoItem.title !== notionItem.title;
              const mappedNotionAssignee = mapAdoAssigneeToNotionEmail(adoItem.assignedTo);
              const assigneeChanged = mappedNotionAssignee !== notionItem.assignee;

              const changes: string[] = [];
              if (statusChanged) changes.push(`status: ${notionItem.status} → ${mappedNotionStatus}`);
              if (titleChanged) changes.push('title changed');
              if (assigneeChanged) changes.push(`assignee changed`);

              if (changes.length === 0) {
                send({
                  type: 'item',
                  item: {
                    id: notionItem.id,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'skipped',
                    actionDetail: 'No changes detected',
                  },
                });
                result.skipped++;
              } else if (dryRun) {
                send({
                  type: 'item',
                  item: {
                    id: notionItem.id,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'updated_in_notion',
                    actionDetail: `Would update: ${changes.join(', ')}`,
                  },
                });
                result.updatedInNotion++;
              } else {
                await notionClient.updateFromAdo(
                  notionItem.id,
                  titleChanged ? adoItem.title : null,
                  statusChanged ? mappedNotionStatus : null,
                  assigneeChanged ? mappedNotionAssignee : null
                );
                send({
                  type: 'item',
                  item: {
                    id: notionItem.id,
                    title: adoItem.title,
                    status: adoItem.state,
                    adoId: String(adoItem.id),
                    action: 'updated_in_notion',
                    actionDetail: changes.join(', '),
                  },
                });
                result.updatedInNotion++;
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              send({
                type: 'item',
                item: {
                  id: adoItem.notionId || `ado-${adoItem.id}`,
                  title: adoItem.title,
                  status: adoItem.state,
                  adoId: String(adoItem.id),
                  action: 'error',
                  actionDetail: errorMessage,
                },
              });
              result.errors.push({
                notionId: adoItem.notionId || 'unknown',
                title: adoItem.title,
                error: errorMessage,
              });
            }

            await delay(350);
          }
        }

        // Update history record
        await db
          .update(syncHistory)
          .set({
            created: result.created,
            updated: result.updated,
            updatedInNotion: result.updatedInNotion,
            skipped: result.skipped,
            errorCount: result.errors.length,
            errors: result.errors,
            logs,
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(syncHistory.id, historyRecord.id));

        log('--- Sync Complete ---');
        send({
          type: 'complete',
          result: {
            created: result.created,
            updated: result.updated,
            updatedInNotion: result.updatedInNotion,
            skipped: result.skipped,
            errorCount: result.errors.length,
          },
        });
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : 'Sync failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
