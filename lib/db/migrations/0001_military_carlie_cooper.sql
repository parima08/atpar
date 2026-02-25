CREATE TABLE IF NOT EXISTS "sync_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"notion_database_id" varchar(255),
	"notion_status_property" varchar(255) DEFAULT 'Status',
	"notion_assignee_property" varchar(255) DEFAULT 'Assignee',
	"notion_description_property" varchar(255) DEFAULT 'Description',
	"notion_ado_id_property" varchar(255) DEFAULT 'ADO ID',
	"notion_pbi_url_property" varchar(255) DEFAULT 'PBI',
	"notion_subtask_property" varchar(255),
	"ado_project" varchar(255),
	"ado_area_path" varchar(500),
	"ado_work_type" varchar(255),
	"ado_work_type_field" varchar(255),
	"status_mapping" json DEFAULT '{}'::json,
	"reverse_status_mapping" json DEFAULT '{}'::json,
	"assignee_mapping" json DEFAULT '{}'::json,
	"reverse_assignee_mapping" json DEFAULT '{}'::json,
	"default_ado_state" varchar(100) DEFAULT 'New',
	"default_notion_status" varchar(100) DEFAULT 'Not started',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_configs_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"direction" varchar(50) NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"updated_in_notion" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" json DEFAULT '[]'::json,
	"logs" json DEFAULT '[]'::json,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" varchar(20) DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sync_configs" ADD CONSTRAINT "sync_configs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "sync_history" ADD CONSTRAINT "sync_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;