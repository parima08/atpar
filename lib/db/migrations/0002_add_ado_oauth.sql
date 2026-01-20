-- Add OAuth fields to sync_configs table
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_auth_type" varchar(20) DEFAULT 'pat';
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_access_token" text;
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_refresh_token" text;
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_token_expires_at" timestamp;
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_user_id" varchar(255);
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_user_email" varchar(255);
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_oauth_org_id" varchar(255);
ALTER TABLE "sync_configs" ADD COLUMN IF NOT EXISTS "ado_webhook_subscription_id" varchar(255);
