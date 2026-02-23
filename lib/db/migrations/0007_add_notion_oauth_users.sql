-- Notion OAuth fields for users (sign in with Notion)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notion_id" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notion_access_token" text;
CREATE UNIQUE INDEX IF NOT EXISTS "users_notion_id_unique" ON "users" ("notion_id") WHERE "notion_id" IS NOT NULL;
