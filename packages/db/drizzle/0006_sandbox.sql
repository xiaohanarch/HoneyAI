CREATE TYPE "public"."sandbox_status" AS ENUM('pending', 'running', 'terminated', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sandbox_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"dek_id" uuid NOT NULL,
	"injected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redacted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sandboxes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"namespace" text DEFAULT 'honeyai' NOT NULL,
	"job_name" text NOT NULL,
	"pod_name" text,
	"image_digest" text NOT NULL,
	"resource_cpu" text DEFAULT '2' NOT NULL,
	"resource_memory" text DEFAULT '2Gi' NOT NULL,
	"resource_storage" text DEFAULT '5Gi' NOT NULL,
	"status" "sandbox_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandboxes_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandbox_credentials" ADD CONSTRAINT "sandbox_credentials_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
