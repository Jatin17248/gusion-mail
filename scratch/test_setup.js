import "dotenv/config";
import postgres from "postgres";
import { provisionCorsairTenant } from "../src/server/lib/corsair-setup";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment");
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function run() {
  try {
    // Find a user with a corsair_tenant_id
    const users = await sql`
      SELECT id, email, corsair_tenant_id FROM users WHERE corsair_tenant_id IS NOT NULL LIMIT 1
    `;
    if (users.length === 0) {
      console.log("No user with corsair_tenant_id found.");
      return;
    }
    const user = users[0];
    console.log("Using user:", user.email, "tenant ID:", user.corsair_tenant_id);

    console.log("--- First provision run ---");
    await provisionCorsairTenant(user.id, user.corsair_tenant_id, process.env.CORSAIR_KEK);
    console.log("First run completed.");

    console.log("--- Second provision run ---");
    await provisionCorsairTenant(user.id, user.corsair_tenant_id, process.env.CORSAIR_KEK);
    console.log("Second run completed.");

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();
