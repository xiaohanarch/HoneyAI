CREATE TABLE IF NOT EXISTS "data_encryption_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kek_version" integer NOT NULL,
	"encrypted_dek" text NOT NULL,
	"algorithm" text DEFAULT 'AES-256-GCM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
