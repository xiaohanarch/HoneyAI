CREATE TYPE "public"."asset_kind" AS ENUM('skill', 'rule', 'command', 'script', 'hook', 'hint', 'template', 'context');--> statement-breakpoint
CREATE TYPE "public"."asset_sync_mode" AS ENUM('manual', 'mirror', 'import-once');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"kind" text NOT NULL,
	"repo_url" text NOT NULL,
	"sub_path" text DEFAULT '' NOT NULL,
	"sync_mode" "asset_sync_mode" NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_sha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"frontmatter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"author_user_id" uuid,
	"author_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"source_id" uuid,
	"source_path" text,
	"name" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"description" text,
	"current_version_id" uuid,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_sources" ADD CONSTRAINT "asset_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_source_id_asset_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."asset_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_sources_by_tenant" ON "asset_sources" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_versions_by_asset" ON "asset_versions" USING btree ("asset_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_versions_uniq" ON "asset_versions" USING btree ("asset_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_by_tenant_kind" ON "assets" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assets_uniq_name" ON "assets" USING btree ("tenant_id","kind","name");