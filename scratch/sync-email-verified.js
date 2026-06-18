import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment");
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function run() {
  try {
    console.log("Verifying all Drizzle schema columns exist on 'users' table...");

    const ddl = [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" timestamp;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "corsair_tenant_id" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gmail_connected" boolean DEFAULT false;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendar_connected" boolean DEFAULT false;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "viral_signature_enabled" boolean DEFAULT true;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_code" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_started_at" timestamp;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_org_id" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_expiry" timestamp;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_staff" boolean DEFAULT false NOT NULL;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;`
    ];

    for (const stmt of ddl) {
      console.log(`Executing: ${stmt}`);
      await sql.unsafe(stmt);
    }

    console.log("All columns successfully verified/added!");
  } catch (err) {
    console.error("Error executing database alteration:", err);
  } finally {
    await sql.end();
  }
}

run();
