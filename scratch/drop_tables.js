import postgres from "postgres";

const sql = postgres("postgresql://postgres:Jatin%40123@localhost:5432/google-demo");

async function main() {
  console.log("Dropping tables...");
  await sql`DROP TABLE IF EXISTS org_members CASCADE`;
  await sql`DROP TABLE IF EXISTS organizations CASCADE`;
  console.log("Tables dropped successfully!");
  await sql.end();
}

main().catch(console.error);
