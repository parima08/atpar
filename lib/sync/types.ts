/**
 * Type definitions for Notion to ADO sync
 */

// Notion item representation
export interface NotionItem {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  assignee: string | null;
  adoId: string | null;
  adoUrl: string | null;
  lastEditedTime: string;
  // Additional fields for ADO description
  allFields: NotionFieldMap;
  // Subtask relation IDs
  subtaskIds: string[];
}

// Subtask info
export interface SubtaskInfo {
  id: string;
  title: string;
  status: string | null;
}

// Map of all Notion fields for description
export interface NotionFieldMap {
  [fieldName: string]: string | null;
}

// ADO Work Item representation
export interface AdoWorkItem {
  id: number;
  title: string;
  description: string;
  state: string;
  assignedTo: string | null;
  changedDate: string | null;  // System.ChangedDate for timestamp comparison
  notionId: string | null;     // Extracted from tags (notion-id:xxx)
}

// Configuration for status mapping (Notion -> ADO)
export interface StatusMapping {
  [notionStatus: string]: string;
}

// Configuration for reverse status mapping (ADO -> Notion)
export interface ReverseStatusMapping {
  [adoState: string]: string;
}

// Configuration for assignee mapping (Notion email -> ADO user)
export interface AssigneeMapping {
  [notionEmail: string]: string;
}

// Configuration for reverse assignee mapping (ADO display name -> Notion email)
export interface ReverseAssigneeMapping {
  [adoDisplayName: string]: string;
}

// Full configuration object
export interface SyncConfig {
  statusMapping: StatusMapping;
  reverseStatusMapping: ReverseStatusMapping;  // ADO State -> Notion Status
  assigneeMapping: AssigneeMapping;
  reverseAssigneeMapping: ReverseAssigneeMapping;  // ADO display name -> Notion email
  defaultAdoState: string;
  defaultNotionStatus: string;  // Default Notion status when no mapping found
  notionAdoIdProperty: string;
  notionPbiUrlProperty?: string;  // URL field to store ADO PBI link
  notionStatusProperty: string;
  notionAssigneeProperty: string;
  notionDescriptionProperty: string;
  adoWorkType?: string;  // Required "Work Type" field value for some ADO projects
  adoWorkTypeField?: string;  // Field reference name (e.g., "Custom.WorkType")
  adoAreaPath?: string;  // Area path for team assignment (e.g., "MBScrum\\Consumer Experience\\squad-consumer-platform")
  notionSubtaskProperty?: string;  // Relation property name for subtasks
}

// Sync result for logging
export interface SyncResult {
  created: number;           // Items created in ADO from Notion
  updated: number;           // Items updated in ADO from Notion
  updatedInNotion: number;   // Items updated in Notion from ADO
  skipped: number;
  errors: SyncError[];
}

export interface SyncError {
  notionId: string;
  title: string;
  error: string;
}

// Environment configuration
export interface EnvConfig {
  notionToken: string;
  notionDatabaseId: string;
  adoPat: string;
  adoOrgUrl: string;
  adoProject: string;
}

// Notion database property info (for field discovery)
export interface NotionPropertyInfo {
  name: string;
  type: string;
  options?: Array<{ name: string; color?: string }>;
}

// ADO field info (for field discovery)
export interface AdoFieldInfo {
  name: string;
  referenceName: string;
  type: string;
}

// ADO state info
export interface AdoStateInfo {
  name: string;
  category: string;
}
