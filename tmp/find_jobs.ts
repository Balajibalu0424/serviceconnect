import 'dotenv/config';
import { db } from '../server/db';
import { users, jobs } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const alice = await db.select().from(users).where(eq(users.email, 'alice@test.com')).limit(1);
  if (!alice[0]) {
    console.error('Alice not found');
    process.exit(1);
  }
  const aliceJobs = await db.select().from(jobs).where(eq(jobs.customerId, alice[0].id));
  console.log(JSON.stringify(aliceJobs, null, 2));
}

run().catch(console.error);
