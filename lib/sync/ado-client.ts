/**
 * Azure DevOps API client wrapper for Work Item operations
 * Supports both PAT (Personal Access Token) and OAuth authentication
 */

import * as azdev from 'azure-devops-node-api';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import { Operation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import type { JsonPatchOperation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import type { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import type { AdoWorkItem, SyncConfig, AssigneeMapping, NotionFieldMap, AdoFieldInfo, AdoStateInfo } from './types';

export type AdoAuthType = 'pat' | 'oauth';

export interface AdoClientConfig {
  orgUrl: string;
  project: string;
  syncConfig: SyncConfig;
  authType: AdoAuthType;
  pat?: string;
  accessToken?: string;
}

export class AdoClient {
  private witApi: IWorkItemTrackingApi | null = null;
  private orgUrl: string;
  private project: string;
  private config: SyncConfig;
  private authType: AdoAuthType;
  private pat?: string;
  private accessToken?: string;

  /**
   * Create an ADO client with PAT authentication (legacy constructor)
   */
  constructor(orgUrl: string, pat: string, project: string, config: SyncConfig);
  /**
   * Create an ADO client with flexible authentication
   */
  constructor(config: AdoClientConfig);
  constructor(
    orgUrlOrConfig: string | AdoClientConfig,
    pat?: string,
    project?: string,
    config?: SyncConfig
  ) {
    if (typeof orgUrlOrConfig === 'string') {
      // Legacy constructor: (orgUrl, pat, project, config)
      this.orgUrl = orgUrlOrConfig;
      this.pat = pat;
      this.project = project!;
      this.config = config!;
      this.authType = 'pat';
    } else {
      // New constructor: (AdoClientConfig)
      this.orgUrl = orgUrlOrConfig.orgUrl;
      this.project = orgUrlOrConfig.project;
      this.config = orgUrlOrConfig.syncConfig;
      this.authType = orgUrlOrConfig.authType;
      this.pat = orgUrlOrConfig.pat;
      this.accessToken = orgUrlOrConfig.accessToken;
    }
  }

  /**
   * Initialize the ADO connection based on auth type
   */
  private async getWitApi(): Promise<IWorkItemTrackingApi> {
    if (!this.witApi) {
      let authHandler;
      
      if (this.authType === 'oauth' && this.accessToken) {
        // Use Bearer token handler for OAuth
        authHandler = azdev.getBearerHandler(this.accessToken);
      } else if (this.pat) {
        // Use PAT handler
        authHandler = azdev.getPersonalAccessTokenHandler(this.pat);
      } else {
        throw new Error('No valid authentication credentials provided');
      }
      
      const connection = new azdev.WebApi(this.orgUrl, authHandler);
      this.witApi = await connection.getWorkItemTrackingApi();
    }
    return this.witApi;
  }
  
  /**
   * Update the access token (useful after token refresh)
   */
  updateAccessToken(newToken: string): void {
    this.accessToken = newToken;
    this.witApi = null; // Clear cached API to force reconnection with new token
  }

  /**
   * Test the ADO connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const witApi = await this.getWitApi();
      // Try to get project info
      await witApi.getWorkItemTypes(this.project);
      return { success: true, message: 'Successfully connected to Azure DevOps' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to connect to Azure DevOps'
      };
    }
  }

  /**
   * Get available work item fields for the project
   */
  async getFields(): Promise<AdoFieldInfo[]> {
    const witApi = await this.getWitApi();
    const fields = await witApi.getFields(this.project);
    
    return fields.map(f => ({
      name: f.name || '',
      referenceName: f.referenceName || '',
      type: f.type?.toString() || 'string',
    }));
  }

  /**
   * Get available states for Product Backlog Items
   */
  async getStates(): Promise<AdoStateInfo[]> {
    const witApi = await this.getWitApi();
    const workItemType = await witApi.getWorkItemType(this.project, 'Product Backlog Item');
    
    if (!workItemType.states) {
      return [];
    }

    return workItemType.states.map(s => ({
      name: s.name || '',
      category: s.category || '',
    }));
  }

  /**
   * Create a new Product Backlog Item
   */
  async createPBI(
    title: string,
    description: string | null,
    state: string,
    assignee: string | null,
    notionId: string,
    allFields?: NotionFieldMap
  ): Promise<AdoWorkItem> {
    const witApi = await this.getWitApi();

    // Map Notion assignee to ADO user
    const adoAssignee = this.mapAssignee(assignee);

    // Build rich description with all Notion fields
    const richDescription = this.formatDescription(description, allFields);

    // Build tags list
    const tags = ['from_notion', `notion-id:${notionId}`];
    
    // Add Squad Cycle / Quarter as tag if available
    if (allFields) {
      const squadCycle = allFields['Squad Cycle'];
      if (squadCycle) {
        tags.push(squadCycle);
      }
    }

    // Build patch document - don't set State on creation, let ADO use default
    const patchDocument: JsonPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: title,
      },
      {
        op: Operation.Add,
        path: '/fields/System.Tags',
        value: tags.join('; '),
      },
    ];

    // Add Work Type if configured (required for some ADO projects)
    if (this.config.adoWorkType && this.config.adoWorkTypeField) {
      patchDocument.push({
        op: Operation.Add,
        path: `/fields/${this.config.adoWorkTypeField}`,
        value: this.config.adoWorkType,
      });
    }

    // Add Area Path if configured (for team assignment)
    if (this.config.adoAreaPath) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.AreaPath',
        value: this.config.adoAreaPath,
      });
    }

    // Add description
    if (richDescription) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.Description',
        value: richDescription,
      });
    }

    // Add assignee if mapped
    if (adoAssignee) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.AssignedTo',
        value: adoAssignee,
      });
    }

    try {
      const workItem = await witApi.createWorkItem(
        null, // custom headers
        patchDocument,
        this.project,
        'Product Backlog Item'
      );

      // If we have a non-default state, update it after creation
      if (state && state !== 'New') {
        try {
          return await this.updatePBI(workItem!.id!, state, assignee);
        } catch (stateError) {
          console.warn(`Created PBI but couldn't set state to "${state}":`, stateError);
          return this.parseWorkItem(workItem);
        }
      }

      return this.parseWorkItem(workItem);
    } catch (error) {
      console.error('ADO createWorkItem error:', error);
      throw error;
    }
  }

  /**
   * Create a Task as a child of a PBI
   */
  async createTask(
    title: string,
    parentId: number,
    notionId: string
  ): Promise<AdoWorkItem> {
    const witApi = await this.getWitApi();

    const patchDocument: JsonPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.Title',
        value: title,
      },
      {
        op: Operation.Add,
        path: '/fields/System.Tags',
        value: `from_notion; notion-subtask:${notionId}`,
      },
      {
        op: Operation.Add,
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.orgUrl}/_apis/wit/workItems/${parentId}`,
        },
      },
    ];

    // Add Area Path if configured
    if (this.config.adoAreaPath) {
      patchDocument.push({
        op: Operation.Add,
        path: '/fields/System.AreaPath',
        value: this.config.adoAreaPath,
      });
    }

    try {
      const workItem = await witApi.createWorkItem(
        null,
        patchDocument,
        this.project,
        'Task'
      );

      return this.parseWorkItem(workItem);
    } catch (error) {
      console.error('ADO createTask error:', error);
      throw error;
    }
  }

  /**
   * Format description with all Notion fields as HTML table
   */
  private formatDescription(
    description: string | null,
    allFields?: NotionFieldMap
  ): string {
    let html = '';

    // Add original description if present
    if (description) {
      html += `<p>${this.escapeHtml(description)}</p>\n`;
    }

    // Add Notion fields table
    if (allFields && Object.keys(allFields).length > 0) {
      html += '<h3>Notion Details</h3>\n';
      html += '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">\n';
      html += '<tbody>\n';

      // Sort fields for consistent display
      const sortedFields = Object.entries(allFields).sort(([a], [b]) => a.localeCompare(b));

      for (const [name, value] of sortedFields) {
        if (value) {
          // Check if value is a URL
          const isUrl = value.startsWith('http://') || value.startsWith('https://');
          const displayValue = isUrl
            ? `<a href="${this.escapeHtml(value)}">${this.escapeHtml(value)}</a>`
            : this.escapeHtml(value);

          html += `<tr><td><strong>${this.escapeHtml(name)}</strong></td><td>${displayValue}</td></tr>\n`;
        }
      }

      html += '</tbody>\n</table>\n';
    }

    return html || '<p>(No description provided)</p>';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get the URL for an ADO work item
   */
  getWorkItemUrl(workItemId: number): string {
    return `${this.orgUrl}/${encodeURIComponent(this.project)}/_workitems/edit/${workItemId}`;
  }

  /**
   * Update an existing Work Item's state
   */
  async updatePBI(
    workItemId: number,
    state: string,
    assignee?: string | null
  ): Promise<AdoWorkItem> {
    const witApi = await this.getWitApi();

    const patchDocument: JsonPatchOperation[] = [
      {
        op: Operation.Add,
        path: '/fields/System.State',
        value: state,
      },
    ];

    // Update assignee if provided
    if (assignee !== undefined) {
      const adoAssignee = this.mapAssignee(assignee);
      if (adoAssignee) {
        patchDocument.push({
          op: Operation.Add,
          path: '/fields/System.AssignedTo',
          value: adoAssignee,
        });
      }
    }

    const workItem = await witApi.updateWorkItem(
      null, // custom headers
      patchDocument,
      workItemId,
      this.project
    );

    return this.parseWorkItem(workItem);
  }

  /**
   * Get a Work Item by ID
   */
  async getWorkItem(workItemId: number): Promise<AdoWorkItem | null> {
    const witApi = await this.getWitApi();

    try {
      const workItem = await witApi.getWorkItem(
        workItemId,
        undefined,
        undefined,
        undefined,
        this.project
      );
      return this.parseWorkItem(workItem);
    } catch (error) {
      console.error(`Error fetching work item ${workItemId}:`, error);
      return null;
    }
  }

  /**
   * Map Notion assignee to ADO assignee
   */
  private mapAssignee(notionAssignee: string | null): string | null {
    if (!notionAssignee) return null;

    // Check if there's a mapping
    const mapping: AssigneeMapping = this.config.assigneeMapping;
    if (mapping[notionAssignee]) {
      return mapping[notionAssignee];
    }

    // If no mapping, try using the email directly
    // ADO might accept it if it's a valid user
    return notionAssignee;
  }

  /**
   * Parse ADO Work Item to our format
   */
  private parseWorkItem(workItem: WorkItem | null): AdoWorkItem {
    if (!workItem || !workItem.id || !workItem.fields) {
      throw new Error('Invalid work item response from ADO');
    }

    // Extract Notion ID from tags
    const tags = workItem.fields['System.Tags'] || '';
    const notionId = this.extractNotionIdFromTags(tags);

    return {
      id: workItem.id,
      title: workItem.fields['System.Title'] || '',
      description: workItem.fields['System.Description'] || '',
      state: workItem.fields['System.State'] || '',
      assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
      changedDate: workItem.fields['System.ChangedDate'] || null,
      notionId,
    };
  }

  /**
   * Extract Notion page ID from ADO tags
   * Tags are formatted like: "from_notion; notion-id:abc123-def456"
   */
  private extractNotionIdFromTags(tags: string): string | null {
    if (!tags) return null;
    const match = tags.match(/notion-id:([a-f0-9-]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Get all work items that are linked from Notion (tagged with from_notion)
   * Used for ADO -> Notion sync direction
   */
  async getLinkedWorkItems(): Promise<AdoWorkItem[]> {
    const witApi = await this.getWitApi();

    // Build WIQL query to find all items tagged with from_notion
    const wiql = {
      query: `
        SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], 
               [System.ChangedDate], [System.Tags], [System.Description]
        FROM WorkItems
        WHERE [System.TeamProject] = '${this.project}'
          AND [System.Tags] CONTAINS 'from_notion'
          AND [System.WorkItemType] = 'Product Backlog Item'
        ORDER BY [System.ChangedDate] DESC
      `,
    };

    try {
      const queryResult = await witApi.queryByWiql(wiql, { project: this.project });
      
      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return [];
      }

      // Get the IDs from the query result
      const ids = queryResult.workItems
        .map(wi => wi.id)
        .filter((id): id is number => id !== undefined);

      if (ids.length === 0) {
        return [];
      }

      // Fetch full work item details (query only returns IDs)
      const workItems = await witApi.getWorkItems(
        ids,
        undefined,
        undefined,
        undefined,
        undefined,
        this.project
      );

      return workItems
        .filter((wi): wi is WorkItem => wi !== null)
        .map(wi => this.parseWorkItem(wi));
    } catch (error) {
      console.error('Error fetching linked work items:', error);
      throw error;
    }
  }
}
