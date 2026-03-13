import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { db } from "./db";
import {
  users, userSessions, professionalProfiles, serviceCategories,
  jobs, jobMatchbooks, jobUnlocks, jobAftercares, jobBoosts,
  quotes, bookings, reviews, conversations, conversationParticipants,
  messages, creditPackages, creditTransactions, payments,
  spinWheelEvents, supportTickets, ticketMessages, notifications,
  adminAuditLogs, platformMetrics, featureFlags
} from "@shared/schema";
import {
  eq, and, ne, or, sql, lt, gt, gte, lte, desc, asc,
  isNull, isNotNull, inArray, count, sum, avg, like, ilike
} from "drizzle-orm";
import {
  requireAuth, requireRole, generateTokens, hashPassword,
  comparePassword, verifyRefreshToken, type AuthRequest
} from "./auth";
import { processMessageContent } from "./profanityFilter";
import { startAftercareScheduler } from "./scheduler";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia"
});

// ─── Helper: create notification ─────────────────────────────────────────────
async function createNotification(userId: string, type: string, title: string, message: string, data: object = {}) {
  await db.insert(notifications).values({ userId, type, title, message, data });
}

// ─── Helper: credit engine (atomic) ──────────────────────────────────────────
async function deductCredits(userId: string, amount: number, type: any, description: string, referenceType?: string, referenceId?: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, userId)).for("update");
    if (!user) throw new Error("User not found");
    if (user.balance < amount) throw new Error("Insufficient credits");
    const newBalance = user.balance - amount;
    await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, userId));
    await tx.insert(creditTransactions).values({
      userId, type, amount: -amount, balanceAfter: newBalance,
      description, referenceType: referenceType || null, referenceId: referenceId || null
    });
    return newBalance;
  });
}

async function addCredits(userId: string, amount: number, type: any, description: string, referenceType?: string, referenceId?: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found");
    const newBalance = user.balance + amount;
    await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, userId));
    await tx.insert(creditTransactions).values({
      userId, type, amount, balanceAfter: newBalance,
      description, referenceType: referenceType || null, referenceId: referenceId || null
    });
    return newBalance;
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ─── Socket.io ──────────────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });
  const onlineUsers = new Map<string, string>(); // userId → socketId

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (userId) onlineUsers.set(userId, socket.id);

    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conv_${conversationId}`);
    });

    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conv_${conversationId}`);
    });

    socket.on("typing", ({ conversationId, isTyping }: any) => {
      socket.to(`conv_${conversationId}`).emit("user_typing", { userId, isTyping });
    });

    socket.on("disconnect", () => {
      if (userId) onlineUsers.delete(userId);
    });
  });

  // Start aftercare scheduler
  startAftercareScheduler(createNotification, io);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, phone, role } = req.body;
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(users).values({
        email: email.toLowerCase(), passwordHash, firstName, lastName,
        phone: phone || null, role: role || "CUSTOMER", status: "ACTIVE",
        emailVerified: false, onboardingCompleted: false
      }).returning();

      if (role === "PROFESSIONAL" || user.role === "PROFESSIONAL") {
        await db.insert(professionalProfiles).values({ userId: user.id });
        // Give pros 20 starter credits
        await addCredits(user.id, 20, "BONUS", "Welcome bonus credits");
      }

      const { accessToken, refreshToken } = generateTokens(user.id, user.role);
      return res.status(201).json({ accessToken, refreshToken, user: { ...user, passwordHash: undefined } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email?.toLowerCase() || ""));
      if (!user || !(await comparePassword(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (user.status === "SUSPENDED" || user.status === "BANNED") {
        return res.status(403).json({ error: `Account ${user.status.toLowerCase()}` });
      }
      const { accessToken, refreshToken } = generateTokens(user.id, user.role);
      const refreshHash = Buffer.from(refreshToken).toString("base64");
      await db.insert(userSessions).values({
        userId: user.id, refreshTokenHash: refreshHash,
        ipAddress: req.ip, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      return res.json({ accessToken, refreshToken, user: { ...user, passwordHash: undefined } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
      const payload = verifyRefreshToken(refreshToken);
      const refreshHash = Buffer.from(refreshToken).toString("base64");
      const [session] = await db.select().from(userSessions)
        .where(and(eq(userSessions.userId, payload.userId), eq(userSessions.refreshTokenHash, refreshHash)));
      if (!session) return res.status(401).json({ error: "Invalid refresh token" });
      const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
      if (!user) return res.status(401).json({ error: "User not found" });
      const tokens = generateTokens(user.id, user.role);
      return res.json(tokens);
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    let profile = null;
    if (user.role === "PROFESSIONAL") {
      [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, user.id));
    }
    return res.json({ ...user, passwordHash: undefined, profile });
  });

  app.post("/api/auth/change-password", requireAuth, async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    return res.json({ success: true });
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthRequest, res: Response) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const refreshHash = Buffer.from(refreshToken).toString("base64");
      await db.delete(userSessions).where(
        and(eq(userSessions.userId, req.user!.userId), eq(userSessions.refreshTokenHash, refreshHash))
      );
    }
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/onboarding/customer", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, phone, title, description, categoryId, budgetMin, budgetMax, urgency, locationText, preferredDate } = req.body;

      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

      const result = await db.transaction(async (tx) => {
        const passwordHash = await hashPassword(password);
        const [user] = await tx.insert(users).values({
          email: email.toLowerCase(), passwordHash, firstName, lastName,
          phone: phone || null, role: "CUSTOMER", status: "ACTIVE",
          emailVerified: false, onboardingCompleted: false
        }).returning();

        const [cat] = await tx.select().from(serviceCategories).where(eq(serviceCategories.id, categoryId));
        const creditCost = cat?.baseCreditCost || 2;

        const [job] = await tx.insert(jobs).values({
          customerId: user.id, categoryId, title, description,
          budgetMin: budgetMin ? String(budgetMin) : null,
          budgetMax: budgetMax ? String(budgetMax) : null,
          urgency: urgency || "NORMAL", status: "DRAFT",
          locationText: locationText || null, creditCost, originalCreditCost: creditCost,
          preferredDate: preferredDate ? new Date(preferredDate) : null
        }).returning();

        await tx.update(users).set({ firstJobId: job.id }).where(eq(users.id, user.id));

        return { user, job };
      });

      const { accessToken, refreshToken } = generateTokens(result.user.id, result.user.role);
      // In real app, send OTP email here
      const mockOtp = "123456"; // dev mode

      return res.status(201).json({
        accessToken, refreshToken,
        user: { ...result.user, passwordHash: undefined },
        jobId: result.job.id,
        otp: mockOtp // only in dev
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/onboarding/customer/verify", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { otp } = req.body;
      // In dev mode, accept "123456" as valid OTP
      if (otp !== "123456" && process.env.NODE_ENV !== "development") {
        return res.status(400).json({ error: "Invalid OTP code" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      await db.update(users).set({ emailVerified: true, onboardingCompleted: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Set first job to LIVE
      if (user.firstJobId) {
        await db.update(jobs).set({ status: "LIVE", updatedAt: new Date() }).where(eq(jobs.id, user.firstJobId));

        const [job] = await db.select().from(jobs).where(eq(jobs.id, user.firstJobId));
        return res.json({ success: true, job });
      }

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICE CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/categories", async (_req: Request, res: Response) => {
    const cats = await db.select().from(serviceCategories).where(eq(serviceCategories.isActive, true)).orderBy(asc(serviceCategories.sortOrder));
    return res.json(cats);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // JOBS
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, categoryId, budgetMin, budgetMax, urgency, locationText, preferredDate } = req.body;
      const userId = req.user!.userId;

      // Anti-spam: check blockedRepost
      if (req.body.checkBlocked) {
        const blocked = await db.select().from(jobs)
          .where(and(eq(jobs.customerId, userId), eq(jobs.blockedRepost, true), eq(jobs.categoryId, categoryId)));
        if (blocked.length > 0) {
          return res.status(409).json({ error: "This job has been previously closed. Please contact support." });
        }
      }

      const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, categoryId));
      const creditCost = cat?.baseCreditCost || 2;

      const [job] = await db.insert(jobs).values({
        customerId: userId, categoryId, title, description,
        budgetMin: budgetMin ? String(budgetMin) : null,
        budgetMax: budgetMax ? String(budgetMax) : null,
        urgency: urgency || "NORMAL", status: "LIVE", creditCost, originalCreditCost: creditCost,
        locationText: locationText || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null
      }).returning();

      return res.status(201).json(job);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    const { status, categoryId, page = "1", limit = "20" } = req.query as any;
    const userId = req.user!.userId;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions: any[] = [eq(jobs.customerId, userId)];
    if (status) conditions.push(eq(jobs.status, status));
    if (categoryId) conditions.push(eq(jobs.categoryId, categoryId));

    const result = await db.select().from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(parseInt(limit))
      .offset(offset);
    return res.json(result);
  });

  app.get("/api/jobs/feed", requireAuth, requireRole("PROFESSIONAL", "ADMIN"), async (req: AuthRequest, res: Response) => {
    const { categoryId, location, page = "1", limit = "20" } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions: any[] = [
      or(eq(jobs.status, "LIVE"), eq(jobs.status, "BOOSTED"), eq(jobs.status, "IN_DISCUSSION"))!
    ];
    if (categoryId) conditions.push(eq(jobs.categoryId, categoryId));

    const liveJobs = await db.select({
      job: jobs,
      category: serviceCategories,
      customer: { firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl }
    })
      .from(jobs)
      .leftJoin(serviceCategories, eq(jobs.categoryId, serviceCategories.id))
      .leftJoin(users, eq(jobs.customerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(jobs.isBoosted), desc(jobs.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    // Attach matchbook count and whether pro has matchbooked
    const proId = req.user!.userId;
    const result = await Promise.all(liveJobs.map(async (row) => {
      const matchbookCount = await db.select({ c: count() }).from(jobMatchbooks)
        .where(and(eq(jobMatchbooks.jobId, row.job.id), isNull(jobMatchbooks.removedAt)));
      const [myMatchbook] = await db.select().from(jobMatchbooks)
        .where(and(eq(jobMatchbooks.jobId, row.job.id), eq(jobMatchbooks.professionalId, proId), isNull(jobMatchbooks.removedAt)));
      const [myUnlock] = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, row.job.id), eq(jobUnlocks.professionalId, proId)));
      return {
        ...row.job,
        category: row.category,
        customer: row.customer,
        matchbookCount: matchbookCount[0].c,
        isMatchbooked: !!myMatchbook,
        unlock: myUnlock || null
      };
    }));

    return res.json(result);
  });

  app.get("/api/jobs/matchbooked", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const proId = req.user!.userId;
    const matchbooked = await db.select({ mb: jobMatchbooks, job: jobs, cat: serviceCategories })
      .from(jobMatchbooks)
      .leftJoin(jobs, eq(jobMatchbooks.jobId, jobs.id))
      .leftJoin(serviceCategories, eq(jobs.categoryId, serviceCategories.id))
      .where(and(eq(jobMatchbooks.professionalId, proId), isNull(jobMatchbooks.removedAt)))
      .orderBy(desc(jobMatchbooks.matchbookedAt));
    return res.json(matchbooked);
  });

  app.get("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, job.categoryId));
    const [customer] = await db.select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl, phone: users.phone })
      .from(users).where(eq(users.id, job.customerId));
    return res.json({ ...job, category, customer: { ...customer, phone: undefined } });
  });

  app.patch("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });
    const { title, description, budgetMin, budgetMax, urgency, locationText } = req.body;
    const [updated] = await db.update(jobs)
      .set({ title, description, budgetMin, budgetMax, urgency, locationText, updatedAt: new Date() })
      .where(eq(jobs.id, req.params.id)).returning();
    return res.json(updated);
  });

  app.delete("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.customerId !== req.user!.userId && req.user!.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    await db.update(jobs).set({ status: "CLOSED", updatedAt: new Date() }).where(eq(jobs.id, req.params.id));
    return res.json({ success: true });
  });

  // Matchbook
  app.post("/api/jobs/:id/matchbook", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const proId = req.user!.userId;
    const jobId = req.params.id;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) return res.status(404).json({ error: "Job not found" });

    const existing = await db.select().from(jobMatchbooks)
      .where(and(eq(jobMatchbooks.jobId, jobId), eq(jobMatchbooks.professionalId, proId)));
    if (existing.length > 0 && !existing[0].removedAt) {
      return res.status(409).json({ error: "Already matchbooked" });
    }

    if (existing.length > 0) {
      await db.update(jobMatchbooks).set({ removedAt: null, matchbookedAt: new Date() })
        .where(eq(jobMatchbooks.id, existing[0].id));
    } else {
      await db.insert(jobMatchbooks).values({ jobId, professionalId: proId });
    }
    return res.status(201).json({ success: true });
  });

  app.delete("/api/jobs/:id/matchbook", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const proId = req.user!.userId;
    await db.update(jobMatchbooks)
      .set({ removedAt: new Date() })
      .where(and(eq(jobMatchbooks.jobId, req.params.id), eq(jobMatchbooks.professionalId, proId)));
    return res.json({ success: true });
  });

  // Tiered Unlock
  app.post("/api/jobs/:id/unlock", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const { tier } = req.body as { tier: "FREE" | "STANDARD" };
      const jobId = req.params.id;

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) return res.status(404).json({ error: "Job not found" });

      const existing = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, jobId), eq(jobUnlocks.professionalId, proId)));
      if (existing.length > 0) return res.status(409).json({ error: "Already unlocked this job" });

      const creditsToSpend = tier === "STANDARD" ? job.creditCost : 0;

      await db.transaction(async (tx) => {
        if (creditsToSpend > 0) {
          const [u] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, proId)).for("update");
          if (u.balance < creditsToSpend) throw new Error("Insufficient credits");
          const newBalance = u.balance - creditsToSpend;
          await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, proId));
          await tx.insert(creditTransactions).values({
            userId: proId, type: "SPEND", amount: -creditsToSpend, balanceAfter: newBalance,
            description: `Unlocked job: ${job.title}`, referenceType: "JOB", referenceId: jobId
          });
          await tx.update(jobs).set({ hasTokenPurchases: true, status: "IN_DISCUSSION", updatedAt: new Date() }).where(eq(jobs.id, jobId));
        }

        await tx.insert(jobUnlocks).values({
          jobId, professionalId: proId, tier,
          creditsSpent: creditsToSpend, phoneUnlocked: tier === "STANDARD"
        });

        // Create conversation
        const [conv] = await tx.insert(conversations).values({
          type: "DIRECT", jobId, status: "ACTIVE", createdBy: proId, lastMessageAt: new Date()
        }).returning();

        await tx.insert(conversationParticipants).values([
          { conversationId: conv.id, userId: proId, role: "MEMBER" },
          { conversationId: conv.id, userId: job.customerId, role: "MEMBER" }
        ]);

        const systemMsg = tier === "FREE"
          ? `A professional has unlocked your job. They are using the free tier — contact details are hidden from them.`
          : `A professional has unlocked your job with full access.`;

        await tx.insert(messages).values({
          conversationId: conv.id, senderId: proId, type: "SYSTEM",
          content: systemMsg, isFiltered: false
        });
      });

      // Get customer phone if STANDARD
      let customerPhone = null;
      if (tier === "STANDARD") {
        const [cust] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, job.customerId));
        customerPhone = cust?.phone;
      }

      await createNotification(job.customerId, "JOB_UNLOCK", "Professional interested in your job",
        `A professional has unlocked your job: ${job.title}`, { jobId });

      return res.status(201).json({ success: true, customerPhone });
    } catch (e: any) {
      return res.status(e.message === "Insufficient credits" ? 402 : 500).json({ error: e.message });
    }
  });

  // Upgrade FREE → STANDARD
  app.post("/api/jobs/:id/upgrade", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const jobId = req.params.id;

      const [unlock] = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, jobId), eq(jobUnlocks.professionalId, proId)));
      if (!unlock) return res.status(404).json({ error: "No unlock found" });
      if (unlock.tier === "STANDARD") return res.status(409).json({ error: "Already on Standard tier" });

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      const creditsNeeded = job.creditCost;

      await db.transaction(async (tx) => {
        const [u] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, proId)).for("update");
        if (u.balance < creditsNeeded) throw new Error("Insufficient credits");
        const newBalance = u.balance - creditsNeeded;
        await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, proId));
        await tx.insert(creditTransactions).values({
          userId: proId, type: "UPGRADE", amount: -creditsNeeded, balanceAfter: newBalance,
          description: `Upgraded unlock for job: ${job.title}`, referenceType: "JOB", referenceId: jobId
        });
        await tx.update(jobUnlocks).set({ tier: "STANDARD", phoneUnlocked: true, upgradedAt: new Date() })
          .where(eq(jobUnlocks.id, unlock.id));
        await tx.update(jobs).set({ hasTokenPurchases: true, updatedAt: new Date() }).where(eq(jobs.id, jobId));

        // Find conversation and send system message
        const [conv] = await tx.select().from(conversations)
          .where(and(eq(conversations.jobId, jobId)));
        if (conv) {
          await tx.insert(messages).values({
            conversationId: conv.id, senderId: proId, type: "SYSTEM",
            content: "This professional has upgraded to Standard tier — full contact details are now available.",
            isFiltered: false
          });
        }
      });

      const [cust] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, job.customerId));
      return res.json({ success: true, customerPhone: cust?.phone });
    } catch (e: any) {
      return res.status(e.message === "Insufficient credits" ? 402 : 500).json({ error: e.message });
    }
  });

  // Aftercare respond
  app.post("/api/jobs/:id/aftercare/respond", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sorted } = req.body;
      const jobId = req.params.id;
      const userId = req.user!.userId;

      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.customerId, userId)));
      if (!job) return res.status(404).json({ error: "Job not found or not authorized" });

      const [aftercare] = await db.select().from(jobAftercares)
        .where(and(eq(jobAftercares.jobId, jobId), isNull(jobAftercares.closedAt)))
        .orderBy(desc(jobAftercares.triggeredAt));

      if (!aftercare) return res.status(404).json({ error: "No active aftercare found" });

      const response = sorted ? "SORTED" : "NOT_SORTED";
      await db.update(jobAftercares).set({ customerResponse: response })
        .where(eq(jobAftercares.id, aftercare.id));

      if (sorted) {
        await db.update(jobAftercares).set({ closedAt: new Date() }).where(eq(jobAftercares.id, aftercare.id));
        await db.update(jobs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(jobs.id, jobId));
        return res.json({ success: true, action: "closed", reviewPrompt: aftercare.branch === "FIVE_DAY" });
      } else {
        // Offer boost
        await db.update(jobAftercares).set({ boostOffered: true }).where(eq(jobAftercares.id, aftercare.id));
        return res.json({ success: true, action: "boost_offered", boostFee: 4.99, discountPct: 40 });
      }
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Boost job
  app.post("/api/jobs/:id/boost", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = req.params.id;
      const userId = req.user!.userId;

      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.customerId, userId)));
      if (!job) return res.status(404).json({ error: "Job not found" });

      const boostFee = 4.99;
      const discountPct = 40;
      const newCreditCost = Math.max(1, Math.round(job.originalCreditCost * (1 - discountPct / 100)));

      await db.transaction(async (tx) => {
        await tx.insert(jobBoosts).values({
          jobId, customerId: userId,
          boostFeePaid: String(boostFee),
          creditDiscountPct: discountPct,
          originalCreditCost: job.originalCreditCost,
          boostedCreditCost: newCreditCost,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        await tx.update(jobs).set({
          isBoosted: true, status: "BOOSTED", creditCost: newCreditCost,
          boostCount: job.boostCount + 1, updatedAt: new Date()
        }).where(eq(jobs.id, jobId));

        // Close aftercare
        await tx.update(jobAftercares).set({ boostAccepted: true, closedAt: new Date() })
          .where(and(eq(jobAftercares.jobId, jobId), isNull(jobAftercares.closedAt)));

        await tx.insert(payments).values({
          userId, amount: String(boostFee), currency: "EUR", status: "COMPLETED",
          paymentMethod: "stripe", description: `Boost for job: ${job.title}`,
          referenceType: "JOB_BOOST", referenceId: jobId
        });
      });

      // Notify matching pros
      const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      return res.json({ success: true, job: updatedJob });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/jobs/:id/close", requireAuth, async (req: AuthRequest, res: Response) => {
    const { blockRepost } = req.body;
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, req.params.id), eq(jobs.customerId, req.user!.userId)));
    if (!job) return res.status(404).json({ error: "Job not found" });
    await db.update(jobs).set({
      status: "CLOSED", blockedRepost: blockRepost ? true : false, updatedAt: new Date()
    }).where(eq(jobs.id, req.params.id));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTES
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/quotes", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const { jobId, amount, message, estimatedDuration, validUntil } = req.body;
      const proId = req.user!.userId;

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Must have unlocked first
      const [unlock] = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, jobId), eq(jobUnlocks.professionalId, proId)));
      if (!unlock) return res.status(403).json({ error: "You must unlock this job first" });

      const [quote] = await db.insert(quotes).values({
        jobId, professionalId: proId, customerId: job.customerId,
        amount: String(amount), message: message || null,
        estimatedDuration: estimatedDuration || null, status: "PENDING",
        validUntil: validUntil ? new Date(validUntil) : null
      }).returning();

      await createNotification(job.customerId, "NEW_QUOTE", "New quote received",
        `You received a quote for: ${job.title}`, { jobId, quoteId: quote.id });

      return res.status(201).json(quote);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/quotes", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (!user[0]) return res.status(404).json({ error: "User not found" });

    let conditions: any[] = [];
    if (user[0].role === "CUSTOMER") conditions.push(eq(quotes.customerId, userId));
    else conditions.push(eq(quotes.professionalId, userId));

    const result = await db.select().from(quotes).where(and(...conditions)).orderBy(desc(quotes.createdAt));
    return res.json(result);
  });

  app.post("/api/quotes/:id/accept", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });

      await db.transaction(async (tx) => {
        await tx.update(quotes).set({ status: "ACCEPTED", updatedAt: new Date() }).where(eq(quotes.id, quote.id));

        const [booking] = await tx.insert(bookings).values({
          quoteId: quote.id, jobId: quote.jobId,
          customerId: quote.customerId, professionalId: quote.professionalId,
          totalAmount: quote.amount, status: "CONFIRMED"
        }).returning();

        await tx.update(jobs).set({ status: "IN_DISCUSSION", updatedAt: new Date() }).where(eq(jobs.id, quote.jobId));
      });

      await createNotification(quote.professionalId, "QUOTE_ACCEPTED", "Your quote was accepted!",
        "The customer has accepted your quote.", { quoteId: quote.id, jobId: quote.jobId });

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/quotes/:id/reject", requireAuth, async (req: AuthRequest, res: Response) => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, req.params.id));
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    if (quote.customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });
    await db.update(quotes).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(quotes.id, quote.id));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKINGS
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/bookings", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    let conditions: any[] =
      user.role === "CUSTOMER" ? [eq(bookings.customerId, userId)] : [eq(bookings.professionalId, userId)];
    const result = await db.select().from(bookings).where(and(...conditions)).orderBy(desc(bookings.createdAt));
    return res.json(result);
  });

  app.get("/api/bookings/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const userId = req.user!.userId;
    if (booking.customerId !== userId && booking.professionalId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(booking);
  });

  app.post("/api/bookings/:id/complete", requireAuth, async (req: AuthRequest, res: Response) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.customerId !== req.user!.userId && booking.professionalId !== req.user!.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.update(bookings).set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(bookings.id, req.params.id));
    await db.update(jobs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(jobs.id, booking.jobId));
    return res.json({ success: true });
  });

  app.post("/api/bookings/:id/cancel", requireAuth, async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    await db.update(bookings).set({
      status: "CANCELLED", cancellationReason: reason || null, updatedAt: new Date()
    }).where(eq(bookings.id, req.params.id));
    return res.json({ success: true });
  });

  app.post("/api/bookings/:id/review", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { rating, title, comment } = req.body;
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id));
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const reviewerId = req.user!.userId;
      const revieweeId = reviewerId === booking.customerId ? booking.professionalId : booking.customerId;

      const [review] = await db.insert(reviews).values({
        bookingId: booking.id, reviewerId, revieweeId,
        rating, title: title || null, comment: comment || null
      }).returning();

      // Update pro rating
      if (revieweeId === booking.professionalId) {
        const proReviews = await db.select({ rating: reviews.rating }).from(reviews)
          .where(eq(reviews.revieweeId, booking.professionalId));
        const avg = proReviews.reduce((sum, r) => sum + r.rating, 0) / proReviews.length;
        await db.update(professionalProfiles).set({
          ratingAvg: String(avg.toFixed(2)), totalReviews: proReviews.length, updatedAt: new Date()
        }).where(eq(professionalProfiles.userId, booking.professionalId));
      }

      return res.status(201).json(review);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/chat/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const myConvs = await db.select({ conv: conversations })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .where(eq(conversationParticipants.userId, userId))
      .orderBy(desc(conversations.lastMessageAt));

    const result = await Promise.all(myConvs.map(async ({ conv }) => {
      const participants = await db.select({
        id: users.id, firstName: users.firstName, lastName: users.lastName,
        avatarUrl: users.avatarUrl, role: users.role
      }).from(conversationParticipants)
        .innerJoin(users, eq(conversationParticipants.userId, users.id))
        .where(eq(conversationParticipants.conversationId, conv.id));

      const [lastMsg] = await db.select().from(messages)
        .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt)).limit(1);

      const [unreadResult] = await db.select({ c: count() }).from(messages)
        .where(and(
          eq(messages.conversationId, conv.id),
          ne(messages.senderId, userId),
          isNull(messages.deletedAt)
        ));

      let jobData = null;
      if (conv.jobId) {
        const [j] = await db.select({ title: jobs.title, status: jobs.status }).from(jobs).where(eq(jobs.id, conv.jobId));
        jobData = j;
      }

      return { ...conv, participants, lastMessage: lastMsg, unreadCount: unreadResult.c, job: jobData };
    }));

    return res.json(result);
  });

  app.get("/api/chat/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const convId = req.params.id;
    const { page = "1", limit = "50" } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [participant] = await db.select().from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, userId)));
    if (!participant) return res.status(403).json({ error: "Not a participant in this conversation" });

    const msgs = await db.select().from(messages)
      .where(and(eq(messages.conversationId, convId), isNull(messages.deletedAt)))
      .orderBy(asc(messages.createdAt))
      .limit(parseInt(limit)).offset(offset);

    // Mark as read
    await db.update(conversationParticipants).set({ lastReadAt: new Date() })
      .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, userId)));

    return res.json(msgs);
  });

  app.post("/api/chat/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const convId = req.params.id;
      const { content, type = "TEXT" } = req.body;

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
      if (!conv) return res.status(404).json({ error: "Conversation not found" });

      const [participant] = await db.select().from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, userId)));
      if (!participant) return res.status(403).json({ error: "Not a participant" });

      // Determine if contact masking needed
      let shouldMask = false;
      const [senderUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
      if (senderUser.role === "PROFESSIONAL" && conv.jobId) {
        const [unlock] = await db.select({ tier: jobUnlocks.tier }).from(jobUnlocks)
          .where(and(eq(jobUnlocks.jobId, conv.jobId), eq(jobUnlocks.professionalId, userId)));
        if (unlock?.tier === "FREE") shouldMask = true;
      }

      const { content: processedContent, originalContent, isFiltered, filterFlags } = processMessageContent(content, shouldMask);

      const [msg] = await db.insert(messages).values({
        conversationId: convId, senderId: userId, type: type as any,
        content: processedContent,
        originalContent: originalContent || undefined,
        isFiltered, filterFlags
      }).returning();

      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, convId));

      // Auto-flag in moderation queue if 2+ filter hits
      if (isFiltered && filterFlags.length >= 2) {
        await createNotification("admin", "MESSAGE_FLAGGED", "Message flagged for review",
          "A message has been auto-flagged for moderation", { messageId: msg.id, conversationId: convId });
      }

      // Emit via socket
      io.to(`conv_${convId}`).emit("new_message", msg);

      // Notify other participants
      const otherParticipants = await db.select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, convId), ne(conversationParticipants.userId, userId)));

      for (const p of otherParticipants) {
        await createNotification(p.userId, "NEW_MESSAGE", "New message", processedContent.slice(0, 100), { conversationId: convId });
      }

      return res.status(201).json(msg);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/chat/unread-count", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const myConvIds = await db.select({ convId: conversationParticipants.conversationId })
      .from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
    const ids = myConvIds.map(r => r.convId);
    if (ids.length === 0) return res.json({ count: 0 });

    const [result] = await db.select({ c: count() }).from(messages)
      .where(and(inArray(messages.conversationId, ids), ne(messages.senderId, userId), isNull(messages.deletedAt)));
    return res.json({ count: result.c });
  });

  app.patch("/api/chat/conversations/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
    await db.update(conversationParticipants).set({ lastReadAt: new Date() })
      .where(and(
        eq(conversationParticipants.conversationId, req.params.id),
        eq(conversationParticipants.userId, req.user!.userId)
      ));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDITS
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/credits/packages", async (_req: Request, res: Response) => {
    const pkgs = await db.select().from(creditPackages).where(eq(creditPackages.isActive, true));
    return res.json(pkgs);
  });

  app.get("/api/credits/balance", requireAuth, async (req: AuthRequest, res: Response) => {
    const [user] = await db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, req.user!.userId));
    return res.json({ balance: user?.creditBalance || 0 });
  });

  app.get("/api/credits/transactions", requireAuth, async (req: AuthRequest, res: Response) => {
    const txs = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, req.user!.userId))
      .orderBy(desc(creditTransactions.createdAt)).limit(50);
    return res.json(txs);
  });

  app.post("/api/credits/purchase", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { packageId } = req.body;
      const [pkg] = await db.select().from(creditPackages).where(eq(creditPackages.id, packageId));
      if (!pkg) return res.status(404).json({ error: "Package not found" });

      const totalCredits = pkg.credits + pkg.bonusCredits;

      // In test mode, simulate successful payment
      const [payment] = await db.insert(payments).values({
        userId: req.user!.userId, amount: String(pkg.price), currency: "EUR",
        status: "COMPLETED", paymentMethod: "stripe",
        stripePaymentId: `pi_test_${Date.now()}`,
        description: `Purchased ${pkg.name}: ${totalCredits} credits`,
        referenceType: "CREDIT_PACKAGE", referenceId: packageId
      }).returning();

      const newBalance = await addCredits(req.user!.userId, totalCredits, "PURCHASE",
        `Purchased ${pkg.name}: ${totalCredits} credits`, "PAYMENT", payment.id);

      return res.json({ success: true, creditsAdded: totalCredits, newBalance });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/credits/stripe/payment-intent", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { packageId } = req.body;
      const [pkg] = await db.select().from(creditPackages).where(eq(creditPackages.id, packageId));
      if (!pkg) return res.status(404).json({ error: "Package not found" });

      const intent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(pkg.price) * 100),
        currency: "eur",
        metadata: { userId: req.user!.userId, packageId }
      });

      return res.json({ clientSecret: intent.client_secret });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SPIN WHEEL
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/spin-wheel/status", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const proId = req.user!.userId;
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, proId));
    if (!profile) return res.status(404).json({ error: "Professional profile not found" });

    const now = new Date();
    const eligible = !profile.lastSpinAt || (now.getTime() - new Date(profile.lastSpinAt).getTime() >= 72 * 60 * 60 * 1000);
    const nextEligibleAt = profile.lastSpinAt
      ? new Date(new Date(profile.lastSpinAt).getTime() + 72 * 60 * 60 * 1000)
      : now;

    return res.json({
      eligible,
      nextEligibleAt: eligible ? null : nextEligibleAt,
      spinStreak: profile.spinStreak,
      lastSpinAt: profile.lastSpinAt
    });
  });

  app.post("/api/spin-wheel/spin", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, proId));
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const now = new Date();
      if (profile.lastSpinAt) {
        const hoursSince = (now.getTime() - new Date(profile.lastSpinAt).getTime()) / (60 * 60 * 1000);
        if (hoursSince < 72) {
          return res.status(429).json({
            error: "Not eligible to spin yet",
            nextEligibleAt: new Date(new Date(profile.lastSpinAt).getTime() + 72 * 60 * 60 * 1000)
          });
        }
      }

      // Server-side weighted RNG
      const rand = Math.random() * 100;
      let prizeType: "CREDITS" | "BOOST" | "BADGE" | "DISCOUNT" | "NONE";
      let prizeValue = 0;
      let segmentIndex = 4; // NONE

      if (rand < 25) { prizeType = "CREDITS"; prizeValue = Math.floor(Math.random() * 5) + 1; segmentIndex = 0; }
      else if (rand < 40) { prizeType = "BOOST"; prizeValue = 24; segmentIndex = 1; }
      else if (rand < 50) { prizeType = "BADGE"; prizeValue = 1; segmentIndex = 2; }
      else if (rand < 65) { prizeType = "DISCOUNT"; prizeValue = 20; segmentIndex = 3; }
      else { prizeType = "NONE"; segmentIndex = 4; }

      // Reset streak if > 96h since last spin
      let newStreak = profile.spinStreak + 1;
      if (profile.lastSpinAt) {
        const hoursSince = (now.getTime() - new Date(profile.lastSpinAt).getTime()) / (60 * 60 * 1000);
        if (hoursSince > 96) newStreak = 1;
      }

      const nextEligible = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      await db.insert(spinWheelEvents).values({
        professionalId: proId, spunAt: now, nextEligibleAt: nextEligible,
        prizeType, prizeValue, prizeApplied: false
      });

      await db.update(professionalProfiles).set({
        lastSpinAt: now, spinStreak: newStreak, updatedAt: new Date()
      }).where(eq(professionalProfiles.userId, proId));

      // Apply prizes
      if (prizeType === "CREDITS") {
        await addCredits(proId, prizeValue, "BONUS", `Spin wheel prize: ${prizeValue} credits`);
      } else if (prizeType === "BOOST") {
        const boostUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await db.update(professionalProfiles).set({ profileBoostUntil: boostUntil }).where(eq(professionalProfiles.userId, proId));
      } else if (prizeType === "BADGE") {
        const badges = (profile.earnedBadges as string[]) || [];
        badges.push(`spin_badge_${Date.now()}`);
        await db.update(professionalProfiles).set({ earnedBadges: badges }).where(eq(professionalProfiles.userId, proId));
      }

      return res.json({
        prizeType, prizeValue, segmentIndex, spinStreak: newStreak,
        nextEligibleAt: nextEligible,
        message: prizeType === "NONE" ? "Better luck next time!" :
          prizeType === "CREDITS" ? `You won ${prizeValue} credits!` :
            prizeType === "BOOST" ? "Your profile is boosted for 24 hours!" :
              prizeType === "BADGE" ? "You earned a badge!" :
                `You won a ${prizeValue}% discount on your next lead!`
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/notifications", requireAuth, async (req: AuthRequest, res: Response) => {
    const { page = "1", limit = "20" } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const notifs = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(parseInt(limit)).offset(offset);
    const [{ c }] = await db.select({ c: count() }).from(notifications)
      .where(and(eq(notifications.userId, req.user!.userId), eq(notifications.isRead, false)));
    return res.json({ notifications: notifs, unreadCount: c });
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: AuthRequest, res: Response) => {
    await db.update(notifications).set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.userId, req.user!.userId));
    return res.json({ success: true });
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
    await db.update(notifications).set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.userId)));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/support/tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    const { subject, description, category, priority } = req.body;
    const [ticket] = await db.insert(supportTickets).values({
      userId: req.user!.userId, subject, description,
      category: category || "GENERAL", priority: priority || "MEDIUM"
    }).returning();
    return res.status(201).json(ticket);
  });

  app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    let conditions: any[] = [];
    if (user.role !== "ADMIN" && user.role !== "SUPPORT") conditions.push(eq(supportTickets.userId, userId));
    const tickets = await db.select().from(supportTickets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt));
    return res.json(tickets);
  });

  app.get("/api/support/tickets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const msgs = await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticket.id)).orderBy(asc(ticketMessages.createdAt));
    return res.json({ ...ticket, messages: msgs });
  });

  app.post("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    const { message, isInternal } = req.body;
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const [msg] = await db.insert(ticketMessages).values({
      ticketId: ticket.id, senderId: req.user!.userId, message,
      isInternal: isInternal ? true : false
    }).returning();
    await db.update(supportTickets).set({ status: "IN_PROGRESS", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
    return res.status(201).json(msg);
  });

  app.patch("/api/support/tickets/:id", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    const { status, priority, assignedTo } = req.body;
    const [ticket] = await db.update(supportTickets).set({
      status: status || undefined, priority: priority || undefined,
      assignedTo: assignedTo || undefined, updatedAt: new Date(),
      resolvedAt: status === "RESOLVED" ? new Date() : undefined
    }).where(eq(supportTickets.id, req.params.id)).returning();
    return res.json(ticket);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL PROFILE
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/pro/profile", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, req.user!.userId));
    return res.json(profile);
  });

  app.patch("/api/pro/profile", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const { businessName, bio, yearsExperience, hourlyRate, serviceCategories: cats, serviceAreas, availability, lat, lng, radiusKm } = req.body;
    const [profile] = await db.update(professionalProfiles).set({
      businessName: businessName || undefined,
      yearsExperience: yearsExperience || undefined,
      hourlyRate: hourlyRate ? String(hourlyRate) : undefined,
      serviceCategories: cats || undefined,
      serviceAreas: serviceAreas || undefined,
      availability: availability || undefined,
      lat: lat ? String(lat) : undefined,
      lng: lng ? String(lng) : undefined,
      radiusKm: radiusKm || undefined,
      updatedAt: new Date()
    }).where(eq(professionalProfiles.userId, req.user!.userId)).returning();

    // Also update user bio
    if (bio) await db.update(users).set({ bio, updatedAt: new Date() }).where(eq(users.id, req.user!.userId));
    return res.json(profile);
  });

  app.get("/api/pro/:id/profile", async (req: Request, res: Response) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, req.params.id));
    const proReviews = await db.select().from(reviews).where(eq(reviews.revieweeId, req.params.id)).limit(10);
    return res.json({ ...user, passwordHash: undefined, profile, reviews: proReviews });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/dashboard", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const [totalUsers] = await db.select({ c: count() }).from(users).where(isNull(users.deletedAt));
    const [totalJobs] = await db.select({ c: count() }).from(jobs);
    const [activeJobs] = await db.select({ c: count() }).from(jobs).where(or(eq(jobs.status, "LIVE"), eq(jobs.status, "BOOSTED"))!);
    const [totalRevenue] = await db.select({ s: sum(payments.amount) }).from(payments).where(eq(payments.status, "COMPLETED"));
    const [totalBookings] = await db.select({ c: count() }).from(bookings);
    const [completedBookings] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "COMPLETED"));
    const [openTickets] = await db.select({ c: count() }).from(supportTickets).where(or(eq(supportTickets.status, "OPEN"), eq(supportTickets.status, "IN_PROGRESS"))!);

    // Jobs by status
    const jobsByStatus = await db.select({ status: jobs.status, c: count() }).from(jobs).groupBy(jobs.status);

    // Users by role
    const usersByRole = await db.select({ role: users.role, c: count() }).from(users).groupBy(users.role);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentJobs = await db.select({ c: count() }).from(jobs).where(gte(jobs.createdAt, sevenDaysAgo));
    const recentUsers = await db.select({ c: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo));

    // Aftercare pipeline
    const aftercareJobs = await db.select({ status: jobs.status, c: count() }).from(jobs)
      .where(or(eq(jobs.status, "AFTERCARE_2D"), eq(jobs.status, "AFTERCARE_5D"))!).groupBy(jobs.status);

    return res.json({
      stats: {
        totalUsers: totalUsers.c, totalJobs: totalJobs.c, activeJobs: activeJobs.c,
        totalRevenue: totalRevenue.s || "0", totalBookings: totalBookings.c,
        completedBookings: completedBookings.c, openTickets: openTickets.c,
        recentJobs: recentJobs[0].c, recentUsers: recentUsers[0].c
      },
      jobsByStatus, usersByRole, aftercareJobs
    });
  });

  app.get("/api/admin/users", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { role, status, search, page = "1", limit = "20" } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions: any[] = [isNull(users.deletedAt)];
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));
    if (search) conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`))!);

    const result = await db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt)).limit(parseInt(limit)).offset(offset);
    const [{ c }] = await db.select({ c: count() }).from(users).where(and(...conditions));
    return res.json({ users: result.map(u => ({ ...u, passwordHash: undefined })), total: c });
  });

  app.patch("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { status, role } = req.body;
    const [user] = await db.update(users).set({ status: status || undefined, role: role || undefined, updatedAt: new Date() })
      .where(eq(users.id, req.params.id)).returning();

    await db.insert(adminAuditLogs).values({
      adminId: req.user!.userId, action: "UPDATE_USER", resourceType: "USER",
      resourceId: req.params.id, changes: { status, role }, ipAddress: req.ip
    });

    return res.json({ ...user, passwordHash: undefined });
  });

  app.get("/api/admin/jobs", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { status, page = "1", limit = "20" } = req.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions: any[] = [];
    if (status) conditions.push(eq(jobs.status, status));
    const result = await db.select().from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.createdAt)).limit(parseInt(limit)).offset(offset);
    const [{ c }] = await db.select({ c: count() }).from(jobs).where(conditions.length > 0 ? and(...conditions) : undefined);
    return res.json({ jobs: result, total: c });
  });

  app.get("/api/admin/chat", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const flaggedMessages = await db.select().from(messages)
      .where(and(eq(messages.isFiltered, true), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt)).limit(50);
    return res.json(flaggedMessages);
  });

  app.get("/api/admin/audit-logs", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const logs = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100);
    return res.json(logs);
  });

  app.get("/api/admin/feature-flags", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const flags = await db.select().from(featureFlags).orderBy(asc(featureFlags.key));
    return res.json(flags);
  });

  app.patch("/api/admin/feature-flags/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { isEnabled, rolloutPercentage } = req.body;
    const [flag] = await db.update(featureFlags).set({
      isEnabled: isEnabled !== undefined ? isEnabled : undefined,
      rolloutPercentage: rolloutPercentage !== undefined ? rolloutPercentage : undefined,
      updatedBy: req.user!.userId, updatedAt: new Date()
    }).where(eq(featureFlags.id, req.params.id)).returning();
    return res.json(flag);
  });

  app.get("/api/admin/metrics", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const metrics = await db.select().from(platformMetrics)
      .orderBy(desc(platformMetrics.recordedAt)).limit(100);
    return res.json(metrics);
  });

  app.get("/api/admin/payments", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const result = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
    return res.json(result);
  });

  app.post("/api/admin/credits/grant", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { userId, amount, reason } = req.body;
    const newBalance = await addCredits(userId, amount, "ADMIN_GRANT", reason || "Admin credit grant");
    await db.insert(adminAuditLogs).values({
      adminId: req.user!.userId, action: "GRANT_CREDITS", resourceType: "USER",
      resourceId: userId, changes: { amount, reason }, ipAddress: req.ip
    });
    return res.json({ success: true, newBalance });
  });

  return httpServer;
}
