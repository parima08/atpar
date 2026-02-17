-- Add schedule time fields so users can set when sync runs
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "sync_schedule_hour" integer DEFAULT 8;
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "sync_schedule_minute" integer DEFAULT 0;
