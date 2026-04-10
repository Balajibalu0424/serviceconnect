const pg = require('pg');
require('dotenv').config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const res = await client.query("UPDATE users SET phone = '+35300000000' WHERE phone IS NULL");
    console.log(`Successfully updated ${res.rowCount} users with placeholder phone numbers.`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error during backfill:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
