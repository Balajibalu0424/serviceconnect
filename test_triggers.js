import pg from 'pg';
import 'dotenv/config';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL env var not set. Copy .env.example to .env and fill in credentials.");
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const res = await pool.query(`
      SELECT tgname, relname, tgfoid::regproc
      FROM pg_trigger
      JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
      WHERE nspname = 'public';
    `);
    console.log("TRIGGERS:", JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("DB error:", error);
    process.exit(1);
  }
}
main();
