import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function run() {
  console.log("Running manual schema updates...");
  try {
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_staff" boolean DEFAULT false NOT NULL`;
    console.log("Added 'is_staff' column to 'users' table.");

    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone`;
    console.log("Added 'suspended_at' column to 'users' table.");

    await sql`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payu_customer_id" text`;
    console.log("Added 'payu_customer_id' column to 'subscriptions' table.");

    await sql`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payu_subscription_id" text`;
    console.log("Added 'payu_subscription_id' column to 'subscriptions' table.");

    await sql`
      CREATE TABLE IF NOT EXISTS "system_configs" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "updated_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL
      )
    `;
    console.log("Created 'system_configs' table.");

    console.log("Database schema updates completed successfully!");
  } catch (err) {
    console.error("Failed to run manual migration:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
