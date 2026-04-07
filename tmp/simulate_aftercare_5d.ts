import 'dotenv/config';
import { db } from '../server/db';
import { jobs, jobUnlocks, users } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { runAftercareCheck } from '../server/scheduler';

async function createNotification(userId: string, type: string, title: string, message: string, data?: object) {
  console.log(`[SIM] Notification for ${userId}: ${type} - ${title}: ${message}`, data);
}

async function run() {
  // Scenario B: 5-Day Aftercare (With Purchase)
  // We'll use 'Leaking pipe under kitchen sink' or similar
  const alicesJobs = await db.select().from(jobs).where(sql`title = 'Leaking pipe under kitchen sink'`);
  if (alicesJobs.length === 0) {
    console.error('Job not found');
    process.exit(1);
  }
  const job = alicesJobs[0];
  
  console.log(`Aging job ${job.id} to 125 hours ago with purchase...`);
  
  await db.update(jobs).set({ 
    createdAt: new Date(Date.now() - 125 * 60 * 60 * 1000),
    hasTokenPurchases: true,
    status: 'LIVE' 
  }).where(eq(jobs.id, job.id));

  // Ensure there's actually an unlock record for this job to be realistic
  const pro = await db.select().from(users).where(eq(users.email, 'pro1@test.com')).limit(1);
  await db.insert(jobUnlocks).values({
    jobId: job.id,
    professionalId: pro[0].id,
    tier: 'STANDARD',
    creditsSpent: 2,
    phoneUnlocked: true
  }).onConflictDoNothing();

  console.log('Running Aftercare Check...');
  await runAftercareCheck(createNotification);
  
  const updatedJob = await db.select().from(jobs).where(eq(jobs.id, job.id));
  console.log('Updated Status:', updatedJob[0].status);
}

run().catch(console.error);
