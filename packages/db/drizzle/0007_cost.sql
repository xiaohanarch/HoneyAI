CREATE TYPE "public"."cost_kind" AS ENUM('llm_tokens', 'github_api', 'sandbox_compute', 'storage_write', 'storage_stored', 'egress_bytes');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid,
	"node_id" uuid,
	"kind" "cost_kind" NOT NULL,
	"provider" text NOT NULL,
	"sku" text NOT NULL,
	"quantity" numeric(20, 4) NOT NULL,
	"unit_cost_micro_usd" bigint NOT NULL,
	"total_micro_usd" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_book" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "cost_kind" NOT NULL,
	"provider" text NOT NULL,
	"sku" text NOT NULL,
	"unit_cost_micro_usd" bigint NOT NULL,
	"unit" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_events_by_tenant_time" ON "cost_events" USING btree ("tenant_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_events_by_run" ON "cost_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_events_occurred_brin" ON "cost_events" USING brin ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_uniq_active" ON "pricing_book" USING btree ("kind","provider","sku","effective_from");