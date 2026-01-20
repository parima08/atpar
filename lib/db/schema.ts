import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  json,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  // Trial period fields
  trialStartedAt: timestamp('trial_started_at'),
  trialEndsAt: timestamp('trial_ends_at'),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// ============================================
// Sync Configuration Tables
// ============================================

/**
 * Stores the sync configuration for a team
 * Each team can have one sync configuration
 */
export const syncConfigs = pgTable('sync_configs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id)
    .unique(),
  
  // Credentials (stored per-team)
  notionToken: text('notion_token'),
  
  // ADO Authentication - supports both PAT and OAuth
  adoAuthType: varchar('ado_auth_type', { length: 20 }).default('pat'), // 'pat' | 'oauth'
  adoPat: text('ado_pat'),
  adoOrgUrl: varchar('ado_org_url', { length: 500 }),
  
  // ADO OAuth fields
  adoOAuthAccessToken: text('ado_oauth_access_token'),
  adoOAuthRefreshToken: text('ado_oauth_refresh_token'),
  adoOAuthTokenExpiresAt: timestamp('ado_oauth_token_expires_at'),
  adoOAuthUserId: varchar('ado_oauth_user_id', { length: 255 }),
  adoOAuthUserEmail: varchar('ado_oauth_user_email', { length: 255 }),
  adoOAuthOrgId: varchar('ado_oauth_org_id', { length: 255 }),
  adoWebhookSubscriptionId: varchar('ado_webhook_subscription_id', { length: 255 }),

  // Notion settings - array of database IDs (up to 5)
  notionDatabaseIds: json('notion_database_ids').$type<string[]>().default([]),
  
  // Notion property mappings
  notionStatusProperty: varchar('notion_status_property', { length: 255 }).default('Status'),
  notionAssigneeProperty: varchar('notion_assignee_property', { length: 255 }).default('Assignee'),
  notionDescriptionProperty: varchar('notion_description_property', { length: 255 }).default('Description'),
  notionAdoIdProperty: varchar('notion_ado_id_property', { length: 255 }).default('ADO ID'),
  notionPbiUrlProperty: varchar('notion_pbi_url_property', { length: 255 }).default('PBI'),
  notionSubtaskProperty: varchar('notion_subtask_property', { length: 255 }),

  // ADO settings
  adoProject: varchar('ado_project', { length: 255 }),
  adoAreaPath: varchar('ado_area_path', { length: 500 }),
  adoWorkType: varchar('ado_work_type', { length: 255 }),
  adoWorkTypeField: varchar('ado_work_type_field', { length: 255 }),
  
  // Status and assignee mappings (JSON objects)
  statusMapping: json('status_mapping').$type<Record<string, string>>().default({}),
  reverseStatusMapping: json('reverse_status_mapping').$type<Record<string, string>>().default({}),
  assigneeMapping: json('assignee_mapping').$type<Record<string, string>>().default({}),
  reverseAssigneeMapping: json('reverse_assignee_mapping').$type<Record<string, string>>().default({}),
  
  // Default values
  defaultAdoState: varchar('default_ado_state', { length: 100 }).default('New'),
  defaultNotionStatus: varchar('default_notion_status', { length: 100 }).default('Not started'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Stores the history of sync runs
 */
export const syncHistory = pgTable('sync_history', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  
  // Sync details
  direction: varchar('direction', { length: 50 }).notNull(), // 'both', 'notion-to-ado', 'ado-to-notion'
  dryRun: boolean('dry_run').notNull().default(false),
  
  // Results
  created: integer('created').notNull().default(0),
  updated: integer('updated').notNull().default(0),
  updatedInNotion: integer('updated_in_notion').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  
  // Error details (stored as JSON array)
  errors: json('errors').$type<Array<{ notionId: string; title: string; error: string }>>().default([]),
  
  // Logs (stored as JSON array of log messages)
  logs: json('logs').$type<string[]>().default([]),
  
  // Timing
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  
  // Status
  status: varchar('status', { length: 20 }).notNull().default('running'), // 'running', 'completed', 'failed'
});

// Relations for sync tables
export const syncConfigsRelations = relations(syncConfigs, ({ one }) => ({
  team: one(teams, {
    fields: [syncConfigs.teamId],
    references: [teams.id],
  }),
}));

export const syncHistoryRelations = relations(syncHistory, ({ one }) => ({
  team: one(teams, {
    fields: [syncHistory.teamId],
    references: [teams.id],
  }),
}));

// Type exports for sync tables
export type SyncConfig = typeof syncConfigs.$inferSelect;
export type NewSyncConfig = typeof syncConfigs.$inferInsert;
export type SyncHistory = typeof syncHistory.$inferSelect;
export type NewSyncHistory = typeof syncHistory.$inferInsert;
