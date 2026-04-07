import 'dotenv/config';
import { db } from '../server/db';
import { jobs, jobUnlocks } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { runAftercareCheck } from '../server/scheduler';

// Dummy createNotification to see what it would send
async function createNotification(userId: string, type: string, title: string, message: string, data?: object) {
  console.log(`[SIM] Notification for ${userId}: ${type} - ${title}: ${message}`, data);
}

async function run() {
  // Scenario A: 2-Day Aftercare (No Purchase)
  // We'll update the 'Leaking kitchen sink' job
  const job2dId = 'a4f88843-f4fd-4cd4-932c-5105a85b9678'; // Truncated in output, need to be careful
  
  // Let's find the full ID first
  const alicesJobs = await db.select().from(jobs).where(sql`title = 'Leaking kitchen sink'`);
  if (alicesJobs.length === 0) {
    console.error('Job not found');
    process.exit(1);
  }
  const job = alicesJobs[0];
  console.log(`Aging job ${job.id} to 50 hours ago...`);
  
  await db.update(jobs).set({ 
    createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
    hasTokenPurchases: false,
    status: 'LIVE' 
  }).where(eq(jobs.id, job.id));

  console.log('Running Aftercare Check...');
  await runAftercareCheck(createNotification);
  
  const updatedJob = await db.select().from(jobs).where(eq(jobs.id, job.id));
  console.log('Updated Status:', updatedJob[0].status);
}

run().catch(console.error);
