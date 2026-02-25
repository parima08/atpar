/**
 * Core sync logic for bidirectional Notion <-> ADO synchronization
 */

import { NotionClient } from './notion-client';
import { AdoClient } from './ado-client';
import type { NotionItem, AdoWorkItem, SyncConfig, SyncResult } from './types';

export type SyncDirection = 'both' | 'notion-to-ado' | 'ado-to-notion';

export interface SyncItemDetail {
  id: string;
  title: string;
  status: string | null;
  adoId?: string | null;
  action: 'created' | 'updated' | 'updated_in_notion' | 'skipped' | 'error';
  actionDetail?: string;
}

export class SyncService {
  private notionClient: NotionClient;
  private adoClient: AdoClient;
  private config: SyncConfig;

  constructor(
    notionClient: NotionClient,
    adoClient: AdoClient,
    config: SyncConfig
  ) {
    this.notionClient = notionClient;
    this.adoClient = adoClient;
    this.config = config;
  }

  private dryRun: boolean = false;
  private logs: string[] = [];
  private items: SyncItemDetail[] = [];
  // Track Notion pages we modified during Notion→ADO sync so ADO→Notion
  // doesn't incorrectly skip them due to stale timestamp comparison
  private notionPagesModifiedBySync: Set<string> = new Set();

  private log(message: string) {
    console.log(message);
    this.logs.push(message);
  }

  private addItem(item: SyncItemDetail) {
    this.items.push(item);
  }

  /**
   * Run the full sync process
   * @param limit - Optional limit on number of items to process (for testing)
   * @param dryRun - If true, show what would happen without making changes
   * @param direction - Sync direction: 'both', 'notion-to-ado', or 'ado-to-notion'
   */
  async sync(
    limit?: number,
    dryRun: boolean = false,
    direction: SyncDirection = 'both'
  ): Promise<SyncResult & { logs: string[]; items: SyncItemDetail[] }> {
    this.dryRun = dryRun;
    this.logs = [];
    this.items = [];
    this.notionPagesModifiedBySync = new Set();

    const result: SyncResult = {
      created: 0,
      updated: 0,
      updatedInNotion: 0,
      skipped: 0,
      errors: [],
    };

    // Run Notion -> ADO sync
    if (direction === 'both' || direction === 'notion-to-ado') {
      await this.syncNotionToAdo(result, limit);
    }

    // Run ADO -> Notion sync
    if (direction === 'both' || direction === 'ado-to-notion') {
      await this.syncAdoToNotion(result);
    }

    this.logResults(result);
    return { ...result, logs: this.logs, items: this.items };
  }

  /**
   * Sync from Notion to ADO (original behavior)
   */
  private async syncNotionToAdo(result: SyncResult, limit?: number): Promise<void> {
    this.log('\n=== Notion → ADO Sync ===');

    // Fetch all items from Notion
    let notionItems = await this.notionClient.getAllItems();
    this.log(`Found ${notionItems.length} items in Notion database`);

    // Apply limit if specified
    if (limit && limit > 0) {
      // Filter to only items that need syncing (no ADO ID and no manual ADO URL)
      const itemsToSync = notionItems.filter(item => !item.adoId && !item.adoUrl);
      this.log(`  ${itemsToSync.length} items need to be created`);
      
      notionItems = itemsToSync.slice(0, limit);
      this.log(`  Processing ${notionItems.length} item(s) due to --limit ${limit}`);
    }

    // Process each item
    for (const item of notionItems) {
      try {
        await this.processItem(item, result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`Error processing item "${item.title}": ${errorMessage}`);
        this.addItem({
          id: item.id,
          title: item.title,
          status: item.status,
          adoId: item.adoId,
          action: 'error',
          actionDetail: errorMessage,
        });
        result.errors.push({
          notionId: item.id,
          title: item.title,
          error: errorMessage,
        });
      }

      // Rate limiting - wait between items
      await this.delay(350); // ~3 requests per second for Notion
    }
  }

  /**
   * Sync from ADO to Notion (new bidirectional behavior)
   * Uses last-edit-wins conflict resolution
   */
  private async syncAdoToNotion(result: SyncResult): Promise<void> {
    this.log('\n=== ADO → Notion Sync ===');

    // Fetch all linked work items from ADO
    const adoItems = await this.adoClient.getLinkedWorkItems();
    this.log(`Found ${adoItems.length} linked work items in ADO`);

    for (const adoItem of adoItems) {
      try {
        await this.processAdoItem(adoItem, result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`Error processing ADO item #${adoItem.id} "${adoItem.title}": ${errorMessage}`);
        this.addItem({
          id: adoItem.notionId || `ado-${adoItem.id}`,
          title: adoItem.title,
          status: adoItem.state,
          adoId: String(adoItem.id),
          action: 'error',
          actionDetail: errorMessage,
        });
        result.errors.push({
          notionId: adoItem.notionId || 'unknown',
          title: adoItem.title,
          error: errorMessage,
        });
      }

      // Rate limiting
      await this.delay(350);
    }
  }

  /**
   * Process a single ADO item for syncing back to Notion
   */
  private async processAdoItem(adoItem: AdoWorkItem, result: SyncResult): Promise<void> {
    // Skip if we don't have a Notion ID
    if (!adoItem.notionId) {
      this.log(`Skipping ADO #${adoItem.id} - no Notion ID found in tags`);
      this.addItem({
        id: `ado-${adoItem.id}`,
        title: adoItem.title,
        status: adoItem.state,
        adoId: String(adoItem.id),
        action: 'skipped',
        actionDetail: 'No Notion ID found',
      });
      result.skipped++;
      return;
    }

    // Fetch the corresponding Notion item
    const notionItem = await this.notionClient.getItemById(adoItem.notionId);
    if (!notionItem) {
      this.log(`Notion page ${adoItem.notionId} not found for ADO #${adoItem.id}`);
      this.addItem({
        id: adoItem.notionId,
        title: adoItem.title,
        status: adoItem.state,
        adoId: String(adoItem.id),
        action: 'skipped',
        actionDetail: 'Notion page not found',
      });
      result.skipped++;
      return;
    }

    // Compare timestamps to determine which is newer
    // Skip timestamp check for pages we modified during Notion→ADO sync
    // (our PBI URL write inflated Notion's last_edited_time)
    const wasModifiedBySync = this.notionPagesModifiedBySync.has(adoItem.notionId);

    if (!wasModifiedBySync) {
      const adoChangedDate = adoItem.changedDate ? new Date(adoItem.changedDate) : null;
      const notionEditedDate = notionItem.lastEditedTime ? new Date(notionItem.lastEditedTime) : null;

      // If we can't determine timestamps, skip
      if (!adoChangedDate || !notionEditedDate) {
        this.log(`Skipping "${adoItem.title}" - cannot compare timestamps`);
        this.addItem({
          id: notionItem.id,
          title: adoItem.title,
          status: adoItem.state,
          adoId: String(adoItem.id),
          action: 'skipped',
          actionDetail: 'Cannot compare timestamps',
        });
        result.skipped++;
        return;
      }

      // If Notion is newer or same, skip (Notion -> ADO sync will handle it)
      if (notionEditedDate >= adoChangedDate) {
        this.log(`Skipping "${adoItem.title}" - Notion is newer or equal`);
        this.addItem({
          id: notionItem.id,
          title: adoItem.title,
          status: adoItem.state,
          adoId: String(adoItem.id),
          action: 'skipped',
          actionDetail: 'Notion is newer',
        });
        result.skipped++;
        return;
      }
    }

    // ADO is newer - check what changed and update Notion
    const changes: string[] = [];

    // Map ADO state to Notion status
    const mappedNotionStatus = this.mapAdoStateToNotionStatus(adoItem.state);
    const statusChanged = mappedNotionStatus !== notionItem.status;
    
    // Check title change
    const titleChanged = adoItem.title !== notionItem.title;

    // Map ADO assignee to Notion email
    const mappedNotionAssignee = this.mapAdoAssigneeToNotionEmail(adoItem.assignedTo);
    const assigneeChanged = mappedNotionAssignee !== notionItem.assignee;

    if (statusChanged) changes.push(`status: ${notionItem.status} → ${mappedNotionStatus}`);
    if (titleChanged) changes.push(`title changed`);
    if (assigneeChanged) changes.push(`assignee: ${notionItem.assignee} → ${mappedNotionAssignee}`);

    // If nothing changed, skip
    if (changes.length === 0) {
      this.log(`Skipping "${adoItem.title}" - no changes detected`);
      this.addItem({
        id: notionItem.id,
        title: adoItem.title,
        status: adoItem.state,
        adoId: String(adoItem.id),
        action: 'skipped',
        actionDetail: 'No changes detected',
      });
      result.skipped++;
      return;
    }

    if (this.dryRun) {
      this.log(`[DRY RUN] Would update Notion from ADO #${adoItem.id}: "${adoItem.title}"`);
      this.log(`  Changes: ${changes.join(', ')}`);
      this.addItem({
        id: notionItem.id,
        title: adoItem.title,
        status: adoItem.state,
        adoId: String(adoItem.id),
        action: 'updated_in_notion',
        actionDetail: `Would update: ${changes.join(', ')}`,
      });
      result.updatedInNotion++;
      return;
    }

    // Update Notion
    this.log(`Updating Notion from ADO #${adoItem.id}: "${adoItem.title}"`);
    this.log(`  Changes: ${changes.join(', ')}`);

    await this.notionClient.updateFromAdo(
      notionItem.id,
      titleChanged ? adoItem.title : null,
      statusChanged ? mappedNotionStatus : null,
      assigneeChanged ? mappedNotionAssignee : null
    );

    this.addItem({
      id: notionItem.id,
      title: adoItem.title,
      status: adoItem.state,
      adoId: String(adoItem.id),
      action: 'updated_in_notion',
      actionDetail: changes.join(', '),
    });

    result.updatedInNotion++;
  }

  /**
   * Process a single Notion item
   */
  private async processItem(item: NotionItem, result: SyncResult): Promise<void> {
    // Map Notion status to ADO state
    const adoState = this.mapStatus(item.status);

    // Respect manually created ADO links - if a URL exists but we couldn't parse an ID,
    // skip this item to avoid overwriting the manual link
    if (!item.adoId && item.adoUrl) {
      this.log(`Skipping "${item.title}" - has manual ADO link: ${item.adoUrl}`);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        action: 'skipped',
        actionDetail: 'Has manual ADO link',
      });
      result.skipped++;
      return;
    }

    if (!item.adoId) {
      // New item - create PBI in ADO
      await this.createNewPBI(item, adoState, result);
    } else {
      // Existing item - check if update is needed
      await this.updateExistingPBI(item, adoState, result);
    }
  }

  /**
   * Create a new PBI in ADO for a Notion item
   */
  private async createNewPBI(
    item: NotionItem,
    adoState: string,
    result: SyncResult
  ): Promise<void> {
    const mappedState = this.mapStatus(item.status);
    
    if (this.dryRun) {
      this.log(`[DRY RUN] Would create PBI for: "${item.title}"`);
      this.log(`  Status: ${item.status} → ${mappedState}`);
      this.log(`  Fields: ${Object.keys(item.allFields).length} properties`);
      if (item.subtaskIds.length > 0) {
        this.log(`  Subtasks: ${item.subtaskIds.length} tasks would be created`);
      }
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        action: 'created',
        actionDetail: `Would create in ADO with state: ${mappedState}`,
      });
      result.created++;
      return;
    }

    this.log(`Creating PBI for: "${item.title}"`);

    const pbi = await this.adoClient.createPBI(
      item.title,
      item.description,
      adoState,
      item.assignee,
      item.id,
      item.allFields  // Include all Notion fields in ADO description
    );

    // Get the ADO work item URL
    const adoUrl = this.adoClient.getWorkItemUrl(pbi.id);

    // Write the ADO URL back to Notion's PBI field
    await this.notionClient.updatePbiUrl(item.id, adoUrl);
    this.notionPagesModifiedBySync.add(item.id);

    this.log(`  Created ADO PBI #${pbi.id}: ${adoUrl}`);

    this.addItem({
      id: item.id,
      title: item.title,
      status: item.status,
      adoId: String(pbi.id),
      action: 'created',
      actionDetail: `Created ADO PBI #${pbi.id}`,
    });

    // Create Tasks for subtasks
    if (item.subtaskIds.length > 0) {
      await this.createSubtasks(item.subtaskIds, pbi.id);
    }

    result.created++;
  }

  /**
   * Create ADO Tasks for Notion subtasks
   */
  private async createSubtasks(subtaskIds: string[], parentPbiId: number): Promise<void> {
    this.log(`  Creating ${subtaskIds.length} subtask(s)...`);
    
    // Fetch subtask details from Notion
    const subtasks = await this.notionClient.getSubtasks(subtaskIds);

    for (const subtask of subtasks) {
      try {
        const task = await this.adoClient.createTask(
          subtask.title,
          parentPbiId,
          subtask.id
        );
        this.log(`    Created Task #${task.id}: "${subtask.title}"`);
        
        // Rate limiting
        await this.delay(350);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`    Failed to create task "${subtask.title}": ${errorMessage}`);
      }
    }
  }

  /**
   * Update an existing PBI if status has changed
   */
  private async updateExistingPBI(
    item: NotionItem,
    adoState: string,
    result: SyncResult
  ): Promise<void> {
    const adoId = parseInt(item.adoId!, 10);
    
    if (isNaN(adoId)) {
      this.log(`Invalid ADO ID "${item.adoId}" for item "${item.title}"`);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        adoId: item.adoId,
        action: 'skipped',
        actionDetail: `Invalid ADO ID: ${item.adoId}`,
      });
      result.skipped++;
      return;
    }

    if (this.dryRun) {
      this.log(`[DRY RUN] Would check/update PBI #${adoId}: "${item.title}"`);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        adoId: String(adoId),
        action: 'skipped',
        actionDetail: 'Dry run - would check for updates',
      });
      result.skipped++;
      return;
    }

    // Get current ADO work item state
    const currentPbi = await this.adoClient.getWorkItem(adoId);
    
    if (!currentPbi) {
      this.log(`ADO work item #${adoId} not found for "${item.title}"`);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        adoId: String(adoId),
        action: 'skipped',
        actionDetail: `ADO work item #${adoId} not found`,
      });
      result.skipped++;
      return;
    }

    // Check if state has changed
    if (currentPbi.state === adoState) {
      this.log(`Skipping "${item.title}" - no state change`);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        adoId: String(adoId),
        action: 'skipped',
        actionDetail: `No state change (ADO: ${currentPbi.state})`,
      });
      result.skipped++;
      return;
    }

    // Update the PBI state
    this.log(`Updating PBI #${adoId}: "${item.title}" (${currentPbi.state} -> ${adoState})`);
    try {
      await this.adoClient.updatePBI(adoId, adoState, item.assignee);
      this.addItem({
        id: item.id,
        title: item.title,
        status: item.status,
        adoId: String(adoId),
        action: 'updated',
        actionDetail: `Updated state: ${currentPbi.state} → ${adoState}`,
      });
      result.updated++;
    } catch (error) {
      // Get error message - Azure DevOps errors may have message in different places
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fullError = String(error);
      
      // Check if it's an invalid state error (check both message and full string representation)
      const isStateError = 
        errorMessage.includes('not in the list of supported values') ||
        fullError.includes('not in the list of supported values') ||
        (errorMessage.includes('State') && errorMessage.includes('not')) ||
        (fullError.includes('State') && fullError.includes('not'));
        
      if (isStateError) {
        this.log(`  Cannot transition from "${currentPbi.state}" to "${adoState}" - skipping update`);
        this.log(`     This may be due to ADO state transition rules or an invalid state value.`);
        this.log(`     Notion status: "${item.status}" → ADO state: "${adoState}"`);
        this.addItem({
          id: item.id,
          title: item.title,
          status: item.status,
          adoId: String(adoId),
          action: 'skipped',
          actionDetail: `Cannot transition: ${currentPbi.state} → ${adoState}`,
        });
        result.skipped++;
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }

  /**
   * Map Notion status to ADO state
   */
  private mapStatus(notionStatus: string | null): string {
    if (!notionStatus) {
      return this.config.defaultAdoState;
    }

    const mapping = this.config.statusMapping;
    
    // Check for exact match
    if (mapping[notionStatus]) {
      return mapping[notionStatus];
    }

    // Check for case-insensitive match
    const lowerStatus = notionStatus.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerStatus) {
        return value;
      }
    }

    // Default if no mapping found
    this.log(`No status mapping found for "${notionStatus}", using default: ${this.config.defaultAdoState}`);
    return this.config.defaultAdoState;
  }

  /**
   * Map ADO state to Notion status (reverse mapping)
   */
  private mapAdoStateToNotionStatus(adoState: string | null): string {
    if (!adoState) {
      return this.config.defaultNotionStatus;
    }

    const mapping = this.config.reverseStatusMapping;
    
    // Check for exact match
    if (mapping[adoState]) {
      return mapping[adoState];
    }

    // Check for case-insensitive match
    const lowerState = adoState.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerState) {
        return value;
      }
    }

    // Default if no mapping found
    this.log(`No reverse status mapping found for "${adoState}", using default: ${this.config.defaultNotionStatus}`);
    return this.config.defaultNotionStatus;
  }

  /**
   * Map ADO assignee display name to Notion email (reverse assignee mapping)
   */
  private mapAdoAssigneeToNotionEmail(adoDisplayName: string | null): string | null {
    if (!adoDisplayName) return null;

    const mapping = this.config.reverseAssigneeMapping;
    
    // Check for exact match
    if (mapping[adoDisplayName]) {
      return mapping[adoDisplayName];
    }

    // Check for case-insensitive match
    const lowerName = adoDisplayName.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // If no mapping, return null (we can't guess the email)
    return null;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log sync results summary
   */
  private logResults(result: SyncResult): void {
    this.log('\n--- Sync Complete ---');
    this.log(`Created in ADO: ${result.created}`);
    this.log(`Updated in ADO: ${result.updated}`);
    this.log(`Updated in Notion: ${result.updatedInNotion}`);
    this.log(`Skipped: ${result.skipped}`);
    
    if (result.errors.length > 0) {
      this.log(`Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        this.log(`  - "${error.title}": ${error.error}`);
      }
    }
  }
}
