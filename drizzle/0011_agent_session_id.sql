ALTER TABLE "agent_messages" ADD COLUMN "session_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_session_idx" ON "agent_messages" ("user_id","session_id");
