CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"public_id" text NOT NULL,
	"gmail_message_id" text,
	"thread_id" text,
	"subject" text NOT NULL,
	"snippet" text,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_user_id" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;