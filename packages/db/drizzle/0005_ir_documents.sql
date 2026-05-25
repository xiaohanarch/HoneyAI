CREATE TYPE "public"."ir_stage" AS ENUM('requirement', 'design', 'implementation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ir_documents" (
	"run_id" uuid NOT NULL,
	"stage" "ir_stage" NOT NULL,
	"version" integer NOT NULL,
	"tenant_id" uuid NOT NULL,
	"body" text NOT NULL,
	"frontmatter_json" jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_by_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ir_documents_run_id_stage_version_pk" PRIMARY KEY("run_id","stage","version")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ir_documents" ADD CONSTRAINT "ir_documents_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ir_documents" ADD CONSTRAINT "ir_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ir_documents" ADD CONSTRAINT "ir_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ir_documents_by_current" ON "ir_documents" USING btree ("run_id","stage","version" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ir_documents_by_tenant_created" ON "ir_documents" USING btree ("tenant_id","created_at" DESC NULLS LAST);