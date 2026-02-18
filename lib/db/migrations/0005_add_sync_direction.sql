ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "sync_direction" varchar(50) DEFAULT 'both';
