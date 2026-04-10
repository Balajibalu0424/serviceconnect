import cron from "node-cron";
import { db } from "./db";
import { jobs, jobAftercares, conversations } from "@shared/schema";
import { eq, and, lt, isNull, or } from "drizzle-orm";

// Standalone function — called by both the cron scheduler (local) and
// the Vercel Cron endpoint GET /api/cron/aftercare (production)
export async function runAftercareCheck(
  createNotification: (userId: string, type: string, title: string, message: string, data?: object) => Promise<void>
) {
  console.log("[Aftercare] Running check...");
  const now = new Date();

  // 1. Jobs LIVE for 48+ hours with NO token purchases → AFTERCARE_2D
  const twoDayThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const twoDayCandidates = await db.select().from(jobs)
    .where(and(
      eq(jobs.status, "LIVE"),
      eq(jobs.hasTokenPurchases, false),
      lt(jobs.createdAt, twoDayThreshold)
    ));

  for (const job of twoDayCandidates) {
    const existing = await db.select().from(jobAftercares)
      .where(and(eq(jobAftercares.jobId, job.id), eq(jobAftercares.branch, "TWO_DAY")));
    if (existing.length > 0) continue;

    await db.transaction(async (tx) => {
      await tx.update(jobs).set({ status: "AFTERCARE_2D", aftercareBranch: "TWO_DAY", updatedAt: new Date() })
        .where(eq(jobs.id, job.id));
      await tx.insert(jobAftercares).values({
        jobId: job.id, branch: "TWO_DAY", triggeredAt: new Date()
      });
    });

    await createNotification(job.customerId, "AFTERCARE_2D", "Did you get sorted?",
      `How did your job listing "${job.title}" go? Did someone get the job sorted for you?`,
      { jobId: job.id, branch: "TWO_DAY" }
    );
    console.log(`[Aftercare] Job ${job.id} moved to AFTERCARE_2D`);
  }

  // 2. Jobs LIVE/IN_DISCUSSION for 120+ hours with token purchases → AFTERCARE_5D
  const fiveDayThreshold = new Date(now.getTime() - 120 * 60 * 60 * 1000);
  const fiveDayCandidates = await db.select().from(jobs)
    .where(and(
      or(eq(jobs.status, "LIVE"), eq(jobs.status, "IN_DISCUSSION"))!,
      eq(jobs.hasTokenPurchases, true),
      lt(jobs.createdAt, fiveDayThreshold)
    ));

  for (const job of fiveDayCandidates) {
    const existing = await db.select().from(jobAftercares)
      .where(and(eq(jobAftercares.jobId, job.id), eq(jobAftercares.branch, "FIVE_DAY")));
    if (existing.length > 0) continue;

    await db.transaction(async (tx) => {
      await tx.update(jobs).set({ status: "AFTERCARE_5D", aftercareBranch: "FIVE_DAY", updatedAt: new Date() })
        .where(eq(jobs.id, job.id));
      await tx.insert(jobAftercares).values({
        jobId: job.id, branch: "FIVE_DAY", triggeredAt: new Date()
      });
    });

    await createNotification(job.customerId, "AFTERCARE_5D", "Did you get sorted?",
      `How's your job "${job.title}" going? Did a professional sort it out for you?`,
      { jobId: job.id, branch: "FIVE_DAY" }
    );
    console.log(`[Aftercare] Job ${job.id} moved to AFTERCARE_5D`);
  }

  // 3. Jobs in aftercare for 24h with no response → send reminder
  const reminderThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const needReminder = await db.select({ aftercare: jobAftercares, job: jobs })
    .from(jobAftercares)
    .innerJoin(jobs, eq(jobAftercares.jobId, jobs.id))
    .where(and(
      isNull(jobAftercares.customerResponse),
      isNull(jobAftercares.closedAt),
      isNull(jobAftercares.reminderSentAt),
      lt(jobAftercares.triggeredAt, reminderThreshold)
    ));

  for (const { aftercare, job } of needReminder) {
    await db.update(jobAftercares).set({ reminderSentAt: new Date() }).where(eq(jobAftercares.id, aftercare.id));
    await createNotification(job.customerId, "AFTERCARE_REMINDER", "Reminder: Did you get sorted?",
      `Just checking in — did someone help with your job "${job.title}"?`,
      { jobId: job.id }
    );
  }

  // 4. Jobs in aftercare for 72h with no response → auto-close
  const autoCloseThreshold = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const toAutoClose = await db.select({ aftercare: jobAftercares, job: jobs })
    .from(jobAftercares)
    .innerJoin(jobs, eq(jobAftercares.jobId, jobs.id))
    .where(and(
      isNull(jobAftercares.customerResponse),
      isNull(jobAftercares.closedAt),
      isNull(jobAftercares.autoClosedAt),
      lt(jobAftercares.triggeredAt, autoCloseThreshold)
    ));

  for (const { aftercare, job } of toAutoClose) {
    await db.transaction(async (tx) => {
      await tx.update(jobAftercares).set({ autoClosedAt: new Date(), closedAt: new Date() })
        .where(eq(jobAftercares.id, aftercare.id));
      await tx.update(jobs).set({ status: "CLOSED", updatedAt: new Date() }).where(eq(jobs.id, job.id));
      // Archive all conversations linked to this job
      await tx.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, job.id));
    });

    await createNotification(job.customerId, "JOB_AUTO_CLOSED", "Job automatically closed",
      `Your job "${job.title}" has been automatically closed after no response.`,
      { jobId: job.id }
    );
    console.log(`[Aftercare] Job ${job.id} auto-closed`);
  }

  console.log("[Aftercare] Check complete");
}

// Wraps the logic in a node-cron schedule for local/persistent server environments
export function startAftercareScheduler(
  createNotification: (userId: string, type: string, title: string, message: string, data?: object) => Promise<void>,
  io?: any
) {
  cron.schedule("0 * * * *", () => runAftercareCheck(createNotification));
  console.log("[Aftercare Scheduler] Started — runs every hour");
}
