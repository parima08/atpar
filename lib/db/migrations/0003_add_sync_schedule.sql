-- Add scheduled sync fields to sync_configs table
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "sync_schedule" varchar(20) DEFAULT 'manual';
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "qstash_schedule_id" varchar(255);
