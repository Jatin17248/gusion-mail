import "dotenv/config";
import postgres from "postgres";
import { db } from "../src/server/db";
import { corsairEntities } from "../src/server/db/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment");
  process.exit(1);
}

const pgSql = postgres(databaseUrl);

async function run() {
  try {
    // Count incomplete entries before delete
    const beforeCount = await db.select({ count: sql`count(*)` })
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.entityType, "messages"),
          or(
            isNull(sql`data->>'subject'`),
            eq(sql`data->>'subject'`, "")
          )
        )
      );
    console.log("Incomplete cache entries count before delete:", beforeCount[0]?.count);

    // Delete incomplete entries
    const deleteResult = await db.delete(corsairEntities)
      .where(
        and(
          eq(corsairEntities.entityType, "messages"),
          or(
            isNull(sql`data->>'subject'`),
            eq(sql`data->>'subject'`, "")
          )
        )
      );
    console.log("Delete result:", deleteResult);

    // Count incomplete entries after delete
    const afterCount = await db.select({ count: sql`count(*)` })
      .from(corsairEntities)
      .where(
        and(
          eq(corsairEntities.entityType, "messages"),
          or(
            isNull(sql`data->>'subject'`),
            eq(sql`data->>'subject'`, "")
          )
        )
      );
    console.log("Incomplete cache entries count after delete:", afterCount[0]?.count);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pgSql.end();
  }
}

run();
