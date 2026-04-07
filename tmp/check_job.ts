import 'dotenv/config';
import { db } from '../server/db';
import { jobs } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const job = await db.select().from(jobs).where(eq(jobs.id, '51c876d7-0e62-4bd9-b7de-a9a59cfff03c4')).limit(1);
  console.log(JSON.stringify(job[0], null, 2));
}

run().catch(console.error);
