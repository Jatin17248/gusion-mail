import postgres from "postgres";

const sql = postgres("postgresql://postgres:Jatin%40123@localhost:5432/google-demo");

async function main() {
  const result = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log("Existing tables:", result.map(r => r.table_name));
  await sql.end();
}

main().catch(console.error);
