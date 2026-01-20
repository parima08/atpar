/**
 * Notion API client wrapper for database operations
 */

import { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  QueryDataSourceResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { NotionItem, SyncConfig, NotionFieldMap, SubtaskInfo, NotionPropertyInfo } from './types';

export class NotionClient {
  private client: Client;
  private databaseId: string;
  private config: SyncConfig;

  constructor(token: string, databaseId: string, config: SyncConfig) {
    this.client = new Client({ auth: token });
    this.databaseId = databaseId;
    this.config = config;
  }

  /**
   * Test the Notion connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.client.databases.retrieve({ database_id: this.databaseId });
      return { success: true, message: 'Successfully connected to Notion' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to connect to Notion'
      };
    }
  }

  /**
   * Get database properties/schema for field mapping
   */
  async getDatabaseProperties(): Promise<NotionPropertyInfo[]> {
    const database = await this.client.databases.retrieve({ 
      database_id: this.databaseId 
    }) as DatabaseObjectResponse;
    
    const properties: NotionPropertyInfo[] = [];
    
    for (const [name, prop] of Object.entries(database.properties)) {
      const propInfo: NotionPropertyInfo = {
        name,
        type: prop.type,
      };

      // Extract options for select/status/multi_select types
      if (prop.type === 'select' && 'select' in prop && prop.select?.options) {
        propInfo.options = prop.select.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      } else if (prop.type === 'status' && 'status' in prop && prop.status?.options) {
        propInfo.options = prop.status.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      } else if (prop.type === 'multi_select' && 'multi_select' in prop && prop.multi_select?.options) {
        propInfo.options = prop.multi_select.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      }

      properties.push(propInfo);
    }

    return properties;
  }

  /**
   * List accessible databases
   */
  async listDatabases(): Promise<Array<{ id: string; title: string }>> {
    // Search for all items and filter databases client-side (API filter type is limited)
    const response = await this.client.search({
      page_size: 100,
    });

    return (response.results as Array<{ object: string; id: string; title?: Array<{ plain_text: string }> }>)
      .filter(r => r.object === 'database' && 'title' in r)
      .map(db => ({
        id: db.id,
        title: db.title?.map(t => t.plain_text).join('') || 'Untitled',
      }));
  }

  /**
   * Fetch all items from the Notion database
   */
  async getAllItems(): Promise<NotionItem[]> {
    const items: NotionItem[] = [];
    let cursor: string | undefined = undefined;

    do {
      const response: QueryDataSourceResponse = await this.client.dataSources.query({
        data_source_id: this.databaseId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if (page.object === 'page' && 'properties' in page) {
          const item = this.parseNotionPage(page as PageObjectResponse);
          if (item) {
            items.push(item);
          }
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return items;
  }

  /**
   * Parse a Notion page into our NotionItem format
   */
  private parseNotionPage(page: PageObjectResponse): NotionItem | null {
    const properties = page.properties;

    // Get title (find the title property)
    const titleProp = Object.values(properties).find((p) => p.type === 'title');
    const title = this.extractTitle(titleProp);

    if (!title) {
      console.warn(`Skipping page ${page.id} - no title found`);
      return null;
    }

    // Get status
    const statusProp = properties[this.config.notionStatusProperty];
    const status = this.extractStatus(statusProp);

    // Get assignee
    const assigneeProp = properties[this.config.notionAssigneeProperty];
    const assignee = this.extractAssignee(assigneeProp);

    // Get description
    const descProp = properties[this.config.notionDescriptionProperty];
    const description = this.extractRichText(descProp);

    // Get ADO ID from text field (legacy) or extract from PBI URL
    const adoIdProp = properties[this.config.notionAdoIdProperty];
    const adoId = this.extractText(adoIdProp);

    // Get PBI URL field
    const pbiUrlProp = properties[this.config.notionPbiUrlProperty || 'PBI'];
    const adoUrl = this.extractUrl(pbiUrlProp);

    // Extract ADO ID from URL if not in text field
    const finalAdoId = adoId || this.extractAdoIdFromUrl(adoUrl);

    // Extract all fields for the description
    const allFields = this.extractAllFields(properties, page);

    // Get subtask relation IDs
    const subtaskProp = properties[this.config.notionSubtaskProperty || 'Subtask'];
    const subtaskIds = this.extractRelationIds(subtaskProp);

    return {
      id: page.id,
      title,
      description,
      status,
      assignee,
      adoId: finalAdoId,
      adoUrl,
      lastEditedTime: page.last_edited_time,
      allFields,
      subtaskIds,
    };
  }

  /**
   * Extract relation IDs from a relation property
   */
  private extractRelationIds(prop: unknown): string[] {
    if (!prop || typeof prop !== 'object') return [];
    const propObj = prop as { type: string; relation?: Array<{ id: string }> };
    
    if (propObj.type !== 'relation' || !propObj.relation) return [];
    return propObj.relation.map(r => r.id);
  }

  /**
   * Extract all fields from the page for ADO description
   */
  private extractAllFields(
    properties: PageObjectResponse['properties'],
    page: PageObjectResponse
  ): NotionFieldMap {
    const fields: NotionFieldMap = {};

    // Add page URL
    fields['Notion Link'] = page.url;

    for (const [name, prop] of Object.entries(properties)) {
      // Skip the PBI/ADO ID fields - we don't need them in description
      if (name === this.config.notionAdoIdProperty || 
          name === (this.config.notionPbiUrlProperty || 'PBI')) {
        continue;
      }

      const value = this.extractAnyValue(prop);
      if (value) {
        fields[name] = value;
      }
    }

    return fields;
  }

  /**
   * Extract value from any property type
   */
  private extractAnyValue(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    
    const propObj = prop as Record<string, unknown>;
    const type = propObj.type as string;

    switch (type) {
      case 'title':
        return this.extractTitle(prop);
      case 'rich_text':
        return this.extractRichText(prop);
      case 'number': {
        const num = propObj.number;
        return num !== null && num !== undefined ? String(num) : null;
      }
      case 'select': {
        const select = propObj.select as { name: string } | null;
        return select?.name || null;
      }
      case 'multi_select': {
        const multiSelect = propObj.multi_select as Array<{ name: string }> | null;
        return multiSelect?.map(s => s.name).join(', ') || null;
      }
      case 'status': {
        const status = propObj.status as { name: string } | null;
        return status?.name || null;
      }
      case 'date': {
        const date = propObj.date as { start: string; end?: string } | null;
        if (!date) return null;
        return date.end ? `${date.start} → ${date.end}` : date.start;
      }
      case 'people': {
        const people = propObj.people as Array<{ name?: string; person?: { email: string } }> | null;
        return people?.map(p => p.name || p.person?.email || 'Unknown').join(', ') || null;
      }
      case 'checkbox':
        return propObj.checkbox ? 'Yes' : 'No';
      case 'url':
        return propObj.url as string | null;
      case 'email':
        return propObj.email as string | null;
      case 'phone_number':
        return propObj.phone_number as string | null;
      case 'created_time':
        return propObj.created_time as string | null;
      case 'last_edited_time':
        return propObj.last_edited_time as string | null;
      case 'created_by':
      case 'last_edited_by': {
        const user = propObj[type] as { name?: string } | null;
        return user?.name || null;
      }
      case 'relation': {
        const relations = propObj.relation as Array<{ id: string }> | null;
        return relations?.length ? `${relations.length} linked item(s)` : null;
      }
      case 'rollup':
        // Rollups can be complex, just indicate there's data
        return propObj.rollup ? '(rollup data)' : null;
      case 'formula': {
        const formula = propObj.formula as { type: string; string?: string; number?: number; boolean?: boolean } | null;
        if (!formula) return null;
        if (formula.type === 'string') return formula.string || null;
        if (formula.type === 'number') return formula.number?.toString() || null;
        if (formula.type === 'boolean') return formula.boolean ? 'Yes' : 'No';
        return null;
      }
      default:
        return null;
    }
  }

  /**
   * Extract title from title property
   */
  private extractTitle(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const titleProp = prop as { type: string; title?: Array<{ plain_text: string }> };
    if (titleProp.type !== 'title' || !titleProp.title) return null;
    return titleProp.title.map((t) => t.plain_text).join('') || null;
  }

  /**
   * Extract status from select or status property
   */
  private extractStatus(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const propObj = prop as { type: string; select?: { name: string }; status?: { name: string } };
    
    if (propObj.type === 'select' && propObj.select) {
      return propObj.select.name;
    }
    if (propObj.type === 'status' && propObj.status) {
      return propObj.status.name;
    }
    return null;
  }

  /**
   * Extract assignee email from people property
   */
  private extractAssignee(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const propObj = prop as { type: string; people?: Array<{ person?: { email: string } }> };
    
    if (propObj.type !== 'people' || !propObj.people || propObj.people.length === 0) {
      return null;
    }
    return propObj.people[0]?.person?.email || null;
  }

  /**
   * Extract text from rich_text property
   */
  private extractRichText(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const propObj = prop as { type: string; rich_text?: Array<{ plain_text: string }> };
    
    if (propObj.type !== 'rich_text' || !propObj.rich_text) return null;
    return propObj.rich_text.map((t) => t.plain_text).join('') || null;
  }

  /**
   * Extract URL from url property
   */
  private extractUrl(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const propObj = prop as { type: string; url?: string };
    
    if (propObj.type !== 'url') return null;
    return propObj.url || null;
  }

  /**
   * Extract ADO ID from a URL like https://dev.azure.com/org/project/_workitems/edit/12345
   */
  private extractAdoIdFromUrl(url: string | null): string | null {
    if (!url) return null;
    const match = url.match(/_workitems\/edit\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract text from text or rich_text property
   */
  private extractText(prop: unknown): string | null {
    if (!prop || typeof prop !== 'object') return null;
    const propObj = prop as {
      type: string;
      rich_text?: Array<{ plain_text: string }>;
      number?: number;
    };

    if (propObj.type === 'rich_text' && propObj.rich_text) {
      return propObj.rich_text.map((t) => t.plain_text).join('') || null;
    }
    if (propObj.type === 'number' && propObj.number !== null && propObj.number !== undefined) {
      return propObj.number.toString();
    }
    return null;
  }

  /**
   * Update the PBI URL property on a Notion page
   */
  async updatePbiUrl(pageId: string, adoUrl: string): Promise<void> {
    const pbiProperty = this.config.notionPbiUrlProperty || 'PBI';
    
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [pbiProperty]: {
          url: adoUrl,
        },
      },
    });
  }

  /**
   * @deprecated Use updatePbiUrl instead
   * Update the ADO ID property on a Notion page (legacy - text field)
   */
  async updateAdoId(pageId: string, adoId: number): Promise<void> {
    await this.client.pages.update({
      page_id: pageId,
      properties: {
        [this.config.notionAdoIdProperty]: {
          rich_text: [
            {
              type: 'text',
              text: { content: adoId.toString() },
            },
          ],
        },
      },
    });
  }

  /**
   * Fetch subtask details by page IDs
   */
  async getSubtasks(subtaskIds: string[]): Promise<SubtaskInfo[]> {
    const subtasks: SubtaskInfo[] = [];

    for (const id of subtaskIds) {
      try {
        const page = await this.client.pages.retrieve({ page_id: id });
        
        if ('properties' in page) {
          const properties = page.properties;
          
          // Get title
          const titleProp = Object.values(properties).find((p: unknown) => {
            const prop = p as { type: string };
            return prop.type === 'title';
          });
          const title = this.extractTitle(titleProp);

          // Get status if exists
          const statusProp = properties[this.config.notionStatusProperty];
          const status = this.extractStatus(statusProp);

          if (title) {
            subtasks.push({
              id,
              title,
              status,
            });
          }
        }
      } catch (error) {
        console.warn(`Could not fetch subtask ${id}:`, error);
      }
    }

    return subtasks;
  }

  /**
   * Update a Notion page from ADO data (for ADO -> Notion sync)
   * @param pageId - Notion page ID to update
   * @param title - New title from ADO (optional)
   * @param status - New status from ADO (mapped to Notion status)
   * @param assigneeEmail - Assignee email (mapped from ADO display name)
   */
  async updateFromAdo(
    pageId: string,
    title?: string | null,
    status?: string | null,
    assigneeEmail?: string | null
  ): Promise<void> {
    // Build the properties object based on what's being updated
    const properties: Record<string, unknown> = {};

    // Update title if provided
    if (title) {
      // First, get the page to find the title property name
      const page = await this.client.pages.retrieve({ page_id: pageId });
      if ('properties' in page) {
        const titlePropName = Object.entries(page.properties).find(
          ([, prop]) => (prop as { type: string }).type === 'title'
        )?.[0];
        
        if (titlePropName) {
          properties[titlePropName] = {
            title: [
              {
                type: 'text',
                text: { content: title },
              },
            ],
          };
        }
      }
    }

    // Update status if provided
    if (status) {
      // Notion status property can be either 'select' or 'status' type
      // We'll try both approaches - Notion will accept the right one
      properties[this.config.notionStatusProperty] = {
        status: { name: status },
      };
    }

    // Update assignee if email is provided
    // Note: Setting people properties requires knowing the Notion user ID
    // For now, we'll search for the user by email
    if (assigneeEmail) {
      try {
        const users = await this.client.users.list({});
        const matchedUser = users.results.find((user) => {
          if (user.type === 'person' && 'person' in user && user.person?.email) {
            return user.person.email.toLowerCase() === assigneeEmail.toLowerCase();
          }
          return false;
        });

        if (matchedUser) {
          properties[this.config.notionAssigneeProperty] = {
            people: [{ id: matchedUser.id }],
          };
        } else {
          console.warn(`Could not find Notion user with email: ${assigneeEmail}`);
        }
      } catch (error) {
        console.warn(`Error looking up Notion user: ${error}`);
      }
    }

    // Only update if there are properties to update
    if (Object.keys(properties).length > 0) {
      await this.client.pages.update({
        page_id: pageId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: properties as any,
      });
    }
  }

  /**
   * Get a single Notion item by page ID
   */
  async getItemById(pageId: string): Promise<NotionItem | null> {
    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });
      if ('properties' in page) {
        return this.parseNotionPage(page as PageObjectResponse);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching Notion page ${pageId}:`, error);
      return null;
    }
  }
}
