-- Add trial period fields to teams table
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
