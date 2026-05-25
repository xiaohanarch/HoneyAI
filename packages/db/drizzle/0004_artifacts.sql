CREATE TYPE "public"."artifact_kind" AS ENUM('requirement_ir', 'design_ir', 'design_sub_ir', 'impl_ir', 'pr_meta', 'log_chunk', 'raw_input');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('ok', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifact_blobs" (
	"sha256" text PRIMARY KEY NOT NULL,
	"byte_size" bigint NOT NULL,
	"oss_key" text NOT NULL,
	"content_type" text DEFAULT 'text/markdown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_blobs_oss_key_unique" UNIQUE("oss_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" uuid,
	"attempt" integer DEFAULT 1 NOT NULL,
	"kind" "artifact_kind" NOT NULL,
	"status" "artifact_status" DEFAULT 'ok' NOT NULL,
	"blob_sha256" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"author_kind" text NOT NULL,
	"author_user_id" uuid,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_blob_sha256_artifact_blobs_sha256_fk" FOREIGN KEY ("blob_sha256") REFERENCES "public"."artifact_blobs"("sha256") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_by_run_kind" ON "artifacts" USING btree ("run_id","kind","attempt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artifacts_by_tenant_created" ON "artifacts" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artifacts_uniq_node_attempt_kind" ON "artifacts" USING btree ("run_id","node_id","attempt","kind");