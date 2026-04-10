import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import {
  users, userSessions, professionalProfiles, serviceCategories,
  jobs, jobMatchbooks, jobUnlocks, jobAftercares, jobBoosts,
  quotes, bookings, reviews, conversations, conversationParticipants,
  messages, creditPackages, creditTransactions, payments,
  spinWheelEvents, supportTickets, ticketMessages, notifications,
  adminAuditLogs, platformMetrics, featureFlags, callRequests,
  faqArticles, cannedResponses
} from "@shared/schema";
import { pusher } from "./pusher";
import {
  eq, and, ne, or, sql, lt, gt, gte, lte, desc, asc,
  isNull, isNotNull, inArray, count, sum, avg, like, ilike
} from "drizzle-orm";
import {
  requireAuth, requireRole, generateTokens, hashPassword,
  comparePassword, verifyRefreshToken, type AuthRequest
} from "./auth";
import { processMessageContent, maskContactInfo } from "./profanityFilter";
import { moderateText } from "./moderationService";
import { startAftercareScheduler, runAftercareCheck } from "./scheduler";
import {
  scoreJobQuality, detectCategory, detectFakeJob, detectUrgency, nerMaskObfuscated
} from "./aiEngine";
import {
  enhanceJobDescription, smartCategoryDetect, deepFakeAnalysis,
  generateQuoteSuggestion, aiChatAssistant, smartProMatch,
  generateReviewSummary, enhanceProBio, isGeminiAvailable,
  handleOnboardingChat
} from "./geminiService";
import { z } from "zod";
import Stripe from "stripe";
import { registerOnboardingRoutes } from "./onboardingRoutes";
import { DEMO_OTP_CODE } from "@shared/verification";
import { issueVerificationChallenge, verifyVerificationChallenge } from "./verificationService";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover"
});

// ─── Pusher Initialization (Imported from ./pusher) ──────────────────────────


// ─── Helper: create notification ─────────────────────────────────────────────
async function createNotification(userIdOrRole: string, type: string, title: string, message: string, data: object = {}) {
  if (!userIdOrRole) return;

  try {
    // If the recipient is "admin", broadcast this to all ADMIN users
    if (userIdOrRole === "admin") {
      const adminUsers = await db.select().from(users).where(eq(users.role, "ADMIN"));
      if (adminUsers.length === 0) return;

      const notifsToInsert = adminUsers.map(admin => ({
        userId: admin.id,
        type, title, message, data
      }));

      await db.insert(notifications).values(notifsToInsert);

      for (const admin of adminUsers) {
        pusher.trigger(`private-user-${admin.id}`, "new_notification", { type, title, message, data }).catch(err => {
          console.error("Pusher trigger error (notification) for admin:", err);
        });
      }
      return;
    }

    // Otherwise, single user
    await db.insert(notifications).values({ userId: userIdOrRole, type, title, message, data });
    
    // Real-time push via Pusher
    try {
      await pusher.trigger(`private-user-${userIdOrRole}`, "new_notification", { type, title, message, data });
    } catch (err) {
      console.error("Pusher trigger error (notification):", err);
    }
  } catch (err) {
    console.error("Database error creating notification:", err);
    throw err;
  }
}

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

// ─── Helper: safe pagination ────────────────────────────────────────────────
function safePagination(query: { page?: string; limit?: string }, defaults = { page: 1, limit: 20, maxLimit: 100 }) {
  const page = Math.max(1, parseInt(query.page || String(defaults.page)) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(query.limit || String(defaults.limit)) || defaults.limit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ─── Helper: validate budget range ──────────────────────────────────────────
function validateBudget(budgetMin: any, budgetMax: any): { min: number | null; max: number | null; error?: string } {
  const min = budgetMin != null && budgetMin !== "" ? Number(budgetMin) : null;
  const max = budgetMax != null && budgetMax !== "" ? Number(budgetMax) : null;
  if (min != null && (isNaN(min) || min < 0)) return { min: null, max: null, error: "Budget minimum must be a positive number" };
  if (max != null && (isNaN(max) || max < 0)) return { min: null, max: null, error: "Budget maximum must be a positive number" };
  if (min != null && max != null && min > max) return { min: null, max: null, error: "Budget minimum cannot exceed maximum" };
  if (min != null && min > 1_000_000) return { min: null, max: null, error: "Budget minimum seems unreasonably high" };
  if (max != null && max > 1_000_000) return { min: null, max: null, error: "Budget maximum seems unreasonably high" };
  return { min, max };
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
  // ─── Pusher Endpoints ──────────────────────────────────────────────────────
  
  // Auth for private channels
  // Unified Pusher Auth (Handles both signin and channel subscription)
  app.post("/api/pusher/auth", (req: any, res) => {
    if (!req.user) return res.status(401).send("Unauthorized");
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;

    if (channel) {
      // Channel authorization (private-*)
      const authResponse = pusher.authorizeChannel(socketId, channel);
      return res.send(authResponse);
    } else {
      // User authentication (pusher.signin())
      const userData = {
        id: req.user.id.toString(),
        user_info: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email
        }
      };
      const authResponse = pusher.authenticateUser(socketId, userData);
      return res.send(authResponse);
    }
  });

  // Relay signals for WebRTC or real-time events between users
  app.post("/api/pusher/trigger", requireAuth, async (req: AuthRequest, res) => {
    const { to, event, data } = req.body;
    if (!to || !event) return res.status(400).send("Missing target or event");

    try {
      await pusher.trigger(`private-user-${to}`, event, {
        ...data,
        from: req.user!.userId,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Pusher trigger error:", err);
      res.status(500).json({ error: "Failed to relay signal" });
    }
  });

  // Start aftercare scheduler (we'll need to update this to work without IO if needed)
  startAftercareScheduler(createNotification, null);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const requestedRole = req.body?.role || "CUSTOMER";
    if (requestedRole === "CUSTOMER" || requestedRole === "PROFESSIONAL") {
      return res.status(410).json({
        error: "Public registration now runs through the role-aware onboarding flow. Start at /register.",
      });
    }

    try {
      const { email, password, firstName, lastName, phone, role } = req.body;
      if (!email || !password || !firstName || !lastName || !phone) {
        return res.status(400).json({ error: "Missing required fields (email, password, name, and phone are mandatory)" });
      }
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(users).values({
        email: email.toLowerCase(), passwordHash, firstName, lastName,
        phone, role: role || "CUSTOMER", status: "ACTIVE",
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
    const isCustomer = user.role === "CUSTOMER";
    // Strip internal ID from customer-facing responses; admins and pros retain it for system references
    const safeUser = {
      ...(isCustomer ? {} : { id: user.id }),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified ?? false,
      onboardingCompleted: user.onboardingCompleted,
      creditBalance: user.creditBalance,
      createdAt: user.createdAt,
    };
    return res.json({ ...safeUser, profile });
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

  registerOnboardingRoutes(app);

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

  // ─── Phone OTP: Send ──────────────────────────────────────────────────────
  app.post("/api/auth/send-phone-otp", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      if ((user as any).phoneVerified) return res.json({ success: true, alreadyVerified: true });
      if (!user.phone) return res.status(400).json({ error: "No phone number on file. Please add your phone number first." });

      const result = await issueVerificationChallenge({
        userId,
        channel: "PHONE",
        target: user.phone,
        purpose: "PHONE_UPDATE",
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Phone OTP: Verify ───────────────────────────────────────────────────
  app.post("/api/auth/verify-phone-otp", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Verification code required" });

      const valid = await verifyVerificationChallenge({
        userId,
        channel: "PHONE",
        code,
      });

      if (!valid) {
        return res.status(400).json({ error: "Invalid or expired verification code. Please request a new one." });
      }

      await db.update(users).set({ phoneVerified: true, updatedAt: new Date() } as any).where(eq(users.id, userId));

      return res.json({ success: true, message: "Phone number verified successfully." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════

  // AI chat assistant used by PostJob page (step 1) — extracts job details conversationally
  app.post("/api/ai/onboarding-chat", async (req: Request, res: Response) => {
    try {
      const { messages, mode = "CUSTOMER", isLoggedIn = true } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages must be a non-empty array" });
      }
      const cats = await db.select({ id: serviceCategories.id, name: serviceCategories.name, slug: serviceCategories.slug })
        .from(serviceCategories).where(eq(serviceCategories.isActive, true));
      const result = await handleOnboardingChat(messages, mode as "CUSTOMER" | "PROFESSIONAL", cats, isLoggedIn);
      return res.json(result);
    } catch (err: any) {
      console.error("[onboarding-chat]", err);
      return res.status(500).json({ error: err.message || "AI service unavailable" });
    }
  });

  // Legacy one-shot customer onboarding used by PostJob page for non-logged-in users
  app.post("/api/onboarding/customer", async (req: Request, res: Response) => {
    try {
      const {
        firstName, lastName, email, password, phone,
        title, description, categoryId, locationText,
        urgency = "NORMAL", budgetMin, budgetMax, preferredDate
      } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: "First name, last name, email and password are required" });
      }
      if (!title || !description) {
        return res.status(400).json({ error: "Job title and description are required" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check for existing user
      const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists. Please log in." });
      }

      const passwordHash = await hashPassword(password);

      // Create user
      const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: false,
        onboardingCompleted: false,
        creditBalance: 0,
      }).returning();

      // Create draft job
      const referenceCode = "SC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const [newJob] = await db.insert(jobs).values({
        customerId: newUser.id,
        categoryId: categoryId || null,
        title: title.trim(),
        description: description.trim(),
        locationText: locationText?.trim() || null,
        urgency,
        budgetMin: budgetMin ? String(budgetMin) : null,
        budgetMax: budgetMax ? String(budgetMax) : null,
        preferredDate: preferredDate || null,
        status: "DRAFT",
        referenceCode,
      }).returning();

      // Issue email verification challenge
      await issueVerificationChallenge({ userId: newUser.id, channel: "EMAIL", target: normalizedEmail, purpose: "ONBOARDING" });

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(newUser.id, newUser.role);

      // Store refresh token (base64-encoded, matching the login route pattern)
      await db.insert(userSessions).values({
        userId: newUser.id,
        refreshTokenHash: Buffer.from(refreshToken).toString("base64"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip || null,
      });

      return res.status(201).json({ accessToken, refreshToken, jobId: newJob.id });
    } catch (err: any) {
      console.error("[onboarding/customer]", err);
      return res.status(500).json({ error: err.message || "Failed to create account" });
    }
  });

  // Verify email OTP and publish the user's draft job
  app.post("/api/onboarding/customer/verify", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { otp } = req.body;
      if (!otp) return res.status(400).json({ error: "OTP is required" });

      const userId = req.user!.userId;

      const isValid = await verifyVerificationChallenge({ userId, channel: "EMAIL", code: otp });
      if (!isValid) {
        return res.status(400).json({ error: `Invalid or expired code. Demo code: ${DEMO_OTP_CODE}` });
      }

      // Mark user as verified + onboarding complete
      await db.update(users)
        .set({ emailVerified: true, onboardingCompleted: true })
        .where(eq(users.id, userId));

      // Fetch user name for notification
      const [fullUser] = await db.select().from(users).where(eq(users.id, userId));

      // Publish their most recent DRAFT job
      const [draftJob] = await db.select().from(jobs)
        .where(and(eq(jobs.customerId, userId), eq(jobs.status, "DRAFT")))
        .orderBy(desc(jobs.createdAt))
        .limit(1);

      if (draftJob) {
        await db.update(jobs).set({ status: "LIVE" }).where(eq(jobs.id, draftJob.id));
        await createNotification("admin", "JOB_POSTED", "New Job Posted", `${fullUser?.firstName || "Customer"} posted a new job: ${draftJob.title}`);
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[onboarding/customer/verify]", err);
      return res.status(500).json({ error: err.message || "Verification failed" });
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

  // AI: Live job analysis endpoint (called from PostJob form for instant feedback)
  app.post("/api/jobs/analyze", async (req: Request, res: Response) => {
    try {
      const { title = "", description = "", locationText, categoryId } = req.body;
      const allCats = await db.select().from(serviceCategories);
      const selectedCat = allCats.find(c => c.id === categoryId);

      const quality = scoreJobQuality(title, description, locationText, selectedCat?.name || "service");
      const category = !categoryId
        ? detectCategory(title, description, allCats)
        : { categorySlug: selectedCat?.slug ?? null, confidence: "HIGH" as const, reason: "User selected" };
      const urgency = detectUrgency(title, description);

      return res.json({ quality, category, urgency });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, categoryId, budgetMin, budgetMax, urgency, locationText, preferredDate } = req.body;
      const userId = req.user!.userId;

      // ── Input validation ──────────────────────────────────────────────────
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Job title is required." });
      }
      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "Job description is required." });
      }
      if (!categoryId || typeof categoryId !== "string") {
        return res.status(400).json({ error: "Please select a service category." });
      }

      // ── Budget validation ────────────────────────────────────────────────
      const budgetResult = validateBudget(budgetMin, budgetMax);
      if (budgetResult.error) {
        return res.status(400).json({ error: budgetResult.error });
      }

      // ── Content moderation ────────────────────────────────────────────────
      const descMod = moderateText(description, { fieldName: "job description", surface: "job_description", route: "POST /api/jobs", userId });
      if (descMod.blocked) {
        if (descMod.logEntry) console.warn("[MODERATION BLOCK]", JSON.stringify(descMod.logEntry));
        return res.status(422).json({ error: descMod.userMessage });
      }
      const titleMod = moderateText(title, { fieldName: "job title", surface: "job_title", route: "POST /api/jobs", userId });
      if (titleMod.blocked) {
        if (titleMod.logEntry) console.warn("[MODERATION BLOCK]", JSON.stringify(titleMod.logEntry));
        return res.status(422).json({ error: titleMod.userMessage });
      }

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

      // ── AI Engine checks ──────────────────────────────────────────────────
      const [customerUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
      const descWordCount = description.trim().split(/\s+/).filter(Boolean).length;

      const qualityResult = scoreJobQuality(title, description, locationText, cat?.name || "service");
      const fakeResult = detectFakeJob({
        title, description,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        customerEmail: customerUser?.email || "",
        descriptionWordCount: descWordCount,
      });
      const urgencyResult = detectUrgency(title, description);
      const allCats = await db.select().from(serviceCategories);
      const categoryResult = detectCategory(title, description, allCats);

      // Fake job: reject immediately, notify admin
      if (fakeResult.isFake) {
        await createNotification(
          "admin", "JOB_FLAGGED",
          "Fake job flagged",
          `Job '${title}' was blocked: ${fakeResult.reason}`,
          { title, reason: fakeResult.reason, customerId: userId }
        );
        return res.status(422).json({
          error: "Your job posting could not be submitted. Please review the job description and try again.",
          code: "FAKE_JOB_DETECTED",
        });
      }

      // Urgency: auto-upgrade urgency field if keywords found
      const finalUrgency = urgencyResult.isUrgent ? "URGENT" : (urgency || "NORMAL");

      // Generate human-friendly reference code: SC-XXXX (6 alphanum chars)
      const refCode = "SC-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      const [job] = await db.insert(jobs).values({
        customerId: userId, categoryId, title, description,
        referenceCode: refCode,
        budgetMin: budgetMin ? String(budgetMin) : null,
        budgetMax: budgetMax ? String(budgetMax) : null,
        urgency: finalUrgency as any,
        status: "LIVE",
        creditCost, originalCreditCost: creditCost,
        locationText: locationText || null,
        locationTown: req.body.locationTown || null,
        locationEircode: req.body.locationEircode || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        // AI columns
        aiQualityScore: qualityResult.score,
        aiQualityPrompt: qualityResult.prompt,
        aiIsFakeFlag: fakeResult.isFake,
        aiFakeReason: fakeResult.reason,
        aiIsUrgent: urgencyResult.isUrgent,
        aiUrgencyKeywords: urgencyResult.detectedKeywords,
        aiCategorySlug: categoryResult.categorySlug,
        aiCategoryConfidence: categoryResult.confidence,
      }).returning();

      // Notify matching pros if URGENT
      if (urgencyResult.isUrgent) {
        const matchingPros = await db.select({ id: users.id })
          .from(users)
          .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
          .where(
            and(
              eq(users.role, "PROFESSIONAL"),
              eq(users.status, "ACTIVE"),
              sql`${professionalProfiles.serviceCategories}::jsonb ? ${categoryId}`
            )
          );
        for (const pro of matchingPros.slice(0, 50)) {
          await createNotification(
            pro.id, "URGENT_JOB",
            "🚨 Urgent job near you",
            `${title} — respond now to be first.`,
            { jobId: job.id, categoryId }
          );
        }
      }

      return res.status(201).json({ ...job, aiAnalysis: { quality: qualityResult, category: categoryResult, urgency: urgencyResult } });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/jobs", requireAuth, async (req: AuthRequest, res: Response) => {
    const { status, categoryId } = req.query as any;
    const userId = req.user!.userId;
    const { limit, offset } = safePagination(req.query as any);

    let conditions: any[] = [eq(jobs.customerId, userId)];
    if (status) conditions.push(eq(jobs.status, status));
    if (categoryId) conditions.push(eq(jobs.categoryId, categoryId));

    const result = await db.select().from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);
    return res.json(result);
  });

  app.get("/api/jobs/feed", requireAuth, requireRole("PROFESSIONAL", "ADMIN"), async (req: AuthRequest, res: Response) => {
    const { categoryId, location, scope } = req.query as any;
    const { limit, offset } = safePagination(req.query as any);

    let conditions: any[] = [
      inArray(jobs.status, ["LIVE", "BOOSTED", "IN_DISCUSSION"])
    ];

    // ─── Category filtering ───────────────────────────────────────────────
    // If a specific categoryId is passed, filter to that single category.
    // If scope=all is explicitly passed, show all categories (browse mode).
    // Otherwise, auto-filter to the professional's registered service categories.
    if (categoryId) {
      conditions.push(eq(jobs.categoryId, categoryId));
    } else if (scope !== "all") {
      // Fetch the requesting professional's service categories
      const [profile] = await db.select({ serviceCategories: professionalProfiles.serviceCategories })
        .from(professionalProfiles)
        .where(eq(professionalProfiles.userId, req.user!.userId));

      const proCats: string[] = profile?.serviceCategories ?? [];

      if (proCats.length > 0) {
        // Only show jobs matching the pro's registered categories
        conditions.push(inArray(jobs.categoryId, proCats));
      } else {
        // Defensive: pro has no categories — return empty result with a hint
        return res.json({ jobs: [], noCategories: true });
      }
    }

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
      .limit(limit)
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

      // Attach customer phone to unlock record if pro has phone-unlocked this job
      let unlockWithPhone: any = myUnlock || null;
      if (myUnlock?.phoneUnlocked) {
        const [customerFull] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, row.job.customerId));
        unlockWithPhone = { ...myUnlock, customerPhone: customerFull?.phone ?? null };
      }

      return {
        ...row.job,
        category: row.category,
        customer: row.customer,
        matchbookCount: matchbookCount[0].c,
        isMatchbooked: !!myMatchbook,
        unlock: unlockWithPhone
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

    const result = await Promise.all(matchbooked.map(async (row) => {
      const [myUnlock] = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, row.job!.id), eq(jobUnlocks.professionalId, proId)));
      let unlockWithPhone: any = myUnlock || null;
      if (myUnlock?.phoneUnlocked) {
        const [customerFull] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, row.job!.customerId));
        unlockWithPhone = { ...myUnlock, customerPhone: customerFull?.phone ?? null };
      }
      return { ...row, unlock: unlockWithPhone };
    }));

    return res.json(result);
  });

  app.get("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id as string));
    if (!job) return res.status(404).json({ error: "Job not found" });
    const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, job.categoryId));
    const [customer] = await db.select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl, phone: users.phone })
      .from(users).where(eq(users.id, job.customerId));

    // Only expose phone to pros who have a STANDARD (phone-unlocked) record for this job
    let customerPhone: string | null = null;
    const requestingUserId = req.user!.userId;
    const requestingRole = req.user!.role;
    if (requestingRole === "PROFESSIONAL") {
      const [phoneUnlock] = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, job.id), eq(jobUnlocks.professionalId, requestingUserId), eq(jobUnlocks.phoneUnlocked, true)));
      if (phoneUnlock) customerPhone = customer?.phone ?? null;
    }

    return res.json({ ...job, category, customer: { ...customer, phone: customerPhone } });
  });

  app.patch("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id as string));
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });

    // Safe edit rules: only DRAFT/LIVE/BOOSTED jobs can be edited
    const editableStatuses = ["DRAFT", "LIVE", "BOOSTED", "IN_DISCUSSION"];
    if (!editableStatuses.includes(job.status)) {
      return res.status(400).json({ error: `Cannot edit a job with status '${job.status}'. Only draft, live, or in-discussion jobs can be modified.` });
    }

    const { title, description, budgetMin, budgetMax, urgency, locationText, locationTown, locationEircode } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (budgetMin !== undefined) updates.budgetMin = budgetMin ? String(budgetMin) : null;
    if (budgetMax !== undefined) updates.budgetMax = budgetMax ? String(budgetMax) : null;
    if (urgency !== undefined) updates.urgency = urgency;
    if (locationText !== undefined) updates.locationText = locationText;
    if (locationTown !== undefined) updates.locationTown = locationTown;
    if (locationEircode !== undefined) updates.locationEircode = locationEircode;

    const [updated] = await db.update(jobs)
      .set(updates)
      .where(eq(jobs.id, req.params.id as string)).returning();
    return res.json(updated);
  });

  app.delete("/api/jobs/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id as string));
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.customerId !== req.user!.userId && req.user!.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    const delJobId = req.params.id as string;
    await db.update(jobs).set({ status: "CLOSED", updatedAt: new Date() }).where(eq(jobs.id, delJobId));
    // Archive all conversations linked to this job
    await db.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, delJobId));
    return res.json({ success: true });
  });

  // Matchbook
  // Publish a DRAFT job to LIVE
  app.post("/api/jobs/:id/publish", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id as string));
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.customerId !== req.user!.userId && req.user!.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
      if (job.status !== "DRAFT") return res.status(400).json({ error: "Only DRAFT jobs can be published" });

      // ── Content moderation on publish ──────────────────────────────────
      const publishDescMod = moderateText(job.description, { fieldName: "job description" });
      if (publishDescMod.blocked) {
        return res.status(422).json({ error: publishDescMod.userMessage });
      }

      // ── AI Quality Gate on publish ──────────────────────────────────────
      const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, job.categoryId));
      const [customerUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, job.customerId));
      const qualityResult = scoreJobQuality(job.title, job.description, job.locationText, cat?.name || "service");
      const fakeResult = detectFakeJob({
        title: job.title,
        description: job.description,
        budgetMin: job.budgetMin ? Number(job.budgetMin) : null,
        budgetMax: job.budgetMax ? Number(job.budgetMax) : null,
        customerEmail: customerUser?.email || "",
        descriptionWordCount: job.description.trim().split(/\s+/).filter(Boolean).length,
      });

      if (fakeResult.isFake) {
        await createNotification("admin", "JOB_FLAGGED", "Fake job blocked on publish",
          `Job '${job.title}': ${fakeResult.reason}`, { jobId: job.id });
        return res.status(422).json({
          error: "This job could not be published. Please review the content and try again.",
          code: "FAKE_JOB_DETECTED",
        });
      }

      if (!qualityResult.passed) {
        // Save quality score but hold as DRAFT — return the improvement prompt
        await db.update(jobs).set({
          aiQualityScore: qualityResult.score,
          aiQualityPrompt: qualityResult.prompt,
          updatedAt: new Date(),
        }).where(eq(jobs.id, req.params.id as string));
        return res.status(422).json({
          error: "Job description needs more detail before going live.",
          code: "QUALITY_GATE_FAILED",
          qualityScore: qualityResult.score,
          qualityPrompt: qualityResult.prompt,
          issues: qualityResult.issues,
        });
      }

      const urgencyResult = detectUrgency(job.title, job.description);
      const finalUrgency = urgencyResult.isUrgent ? "URGENT" : job.urgency;

      // Also mark user as onboarded/verified
      await db.update(users).set({ emailVerified: true, onboardingCompleted: true, updatedAt: new Date() }).where(eq(users.id, job.customerId));
      const [updated] = await db.update(jobs).set({
        status: "LIVE",
        urgency: finalUrgency as any,
        aiQualityScore: qualityResult.score,
        aiQualityPrompt: qualityResult.prompt,
        aiIsUrgent: urgencyResult.isUrgent,
        aiUrgencyKeywords: urgencyResult.detectedKeywords,
        updatedAt: new Date(),
      }).where(eq(jobs.id, req.params.id as string)).returning();
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/jobs/:id/matchbook", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    const proId = req.user!.userId;
    const jobId = req.params.id as string;
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
      .where(and(eq(jobMatchbooks.jobId, req.params.id as string), eq(jobMatchbooks.professionalId, proId)));
    return res.json({ success: true });
  });

  // Tiered Unlock
  app.post("/api/jobs/:id/unlock", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const { tier } = req.body as { tier: "FREE" | "STANDARD" };
      const jobId = req.params.id as string;

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) return res.status(404).json({ error: "Job not found" });

      if (job.customerId === proId) {
        return res.status(400).json({ error: "You cannot unlock a job you posted yourself." });
      }

      const existing = await db.select().from(jobUnlocks)
        .where(and(eq(jobUnlocks.jobId, jobId), eq(jobUnlocks.professionalId, proId)));
      if (existing.length > 0) return res.status(409).json({ error: "Already unlocked this job" });

      // Check for a pending spin-wheel DISCOUNT prize for this pro (STANDARD unlocks only)
      let effectiveCreditCost = job.creditCost;
      let appliedDiscountEventId: string | null = null;
      if (tier === "STANDARD") {
        const [pendingDiscount] = await db.select().from(spinWheelEvents)
          .where(and(
            eq(spinWheelEvents.professionalId, proId),
            eq(spinWheelEvents.prizeType, "DISCOUNT"),
            eq(spinWheelEvents.prizeApplied, false)
          ))
          .orderBy(asc(spinWheelEvents.id))
          .limit(1);
        if (pendingDiscount) {
          effectiveCreditCost = Math.max(1, Math.floor(job.creditCost * (1 - (pendingDiscount.prizeValue ?? 20) / 100)));
          appliedDiscountEventId = pendingDiscount.id;
        }
      }

      const creditsToSpend = tier === "STANDARD" ? effectiveCreditCost : 0;

      await db.transaction(async (tx) => {
        if (creditsToSpend > 0) {
          const [u] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, proId)).for("update");
          if (u.balance < creditsToSpend) throw new Error("Insufficient credits");
          const newBalance = u.balance - creditsToSpend;
          await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, proId));
          await tx.insert(creditTransactions).values({
            userId: proId, type: "SPEND", amount: -creditsToSpend, balanceAfter: newBalance,
            description: `Unlocked job: ${job.title}${appliedDiscountEventId ? " (spin discount applied)" : ""}`,
            referenceType: "JOB", referenceId: jobId
          });
          await tx.update(jobs).set({ hasTokenPurchases: true, status: "IN_DISCUSSION", updatedAt: new Date() }).where(eq(jobs.id, jobId));
        }

        // Mark spin discount as used
        if (appliedDiscountEventId) {
          await tx.update(spinWheelEvents).set({ prizeApplied: true })
            .where(eq(spinWheelEvents.id, appliedDiscountEventId));
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
          ? `A professional has unlocked your job and can now message you directly.`
          : `A professional has unlocked your job with priority access and can now message you directly.`;

        await tx.insert(messages).values({
          conversationId: conv.id, senderId: proId, type: "SYSTEM",
          content: systemMsg, isFiltered: false
        });
      });

      await createNotification(job.customerId, "JOB_UNLOCK", "Professional interested in your job",
        `A professional has unlocked your job: ${job.title}`, { jobId });

      // Return customer phone for STANDARD unlocks so the pro sees it immediately
      const responseData: any = { success: true };
      if (tier === "STANDARD") {
        const [customerUser] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, job.customerId));
        responseData.customerPhone = customerUser?.phone ?? null;
      }

      return res.status(201).json(responseData);
    } catch (e: any) {
      return res.status(e.message === "Insufficient credits" ? 402 : 500).json({ error: e.message });
    }
  });

  // Upgrade FREE → STANDARD
  app.post("/api/jobs/:id/upgrade", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const jobId = req.params.id as string;

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
            content: "This professional has upgraded to Standard tier — priority messaging enabled. Use in-app chat or request a call.",
            isFiltered: false
          });
        }
      });

      const [customerUser] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, job.customerId));
      return res.json({ success: true, customerPhone: customerUser?.phone ?? null });
    } catch (e: any) {
      return res.status(e.message === "Insufficient credits" ? 402 : 500).json({ error: e.message });
    }
  });

  // Aftercare respond
  app.post("/api/jobs/:id/aftercare/respond", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sorted } = req.body;
      const jobId = req.params.id as string;
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
        // Archive all conversations linked to this job
        await db.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, jobId));
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
  // Decline boost after aftercare NOT_SORTED — choose to close or leave open
  app.post("/api/jobs/:id/aftercare/decline-boost", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { action } = req.body as { action: "close" | "leave_open" };
      const jobId = routeParam(req.params.id);
      const userId = req.user!.userId;

      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.customerId, userId)));
      if (!job) return res.status(404).json({ error: "Job not found or not authorized" });

      if (action === "close") {
        const declineJobId = req.params.id as string;
        await db.update(jobs).set({ status: "CLOSED", updatedAt: new Date() }).where(eq(jobs.id, declineJobId));
        await db.update(jobAftercares).set({ closedAt: new Date() })
          .where(and(eq(jobAftercares.jobId, declineJobId), isNull(jobAftercares.closedAt)));
        // Archive all conversations linked to this job
        await db.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, declineJobId));
        return res.json({ success: true, action: "closed" });
      } else if (action === "leave_open") {
        // Mark blockedRepost so the customer cannot repost the same job category
        await db.update(jobs).set({ blockedRepost: true, updatedAt: new Date() }).where(eq(jobs.id, req.params.id as string));
        await db.update(jobAftercares).set({ closedAt: new Date() })
          .where(and(eq(jobAftercares.jobId, req.params.id as string), isNull(jobAftercares.closedAt)));
        return res.json({ success: true, action: "left_open" });
      } else {
        return res.status(400).json({ error: "Invalid action. Use 'close' or 'leave_open'." });
      }
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/jobs/:id/boost", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const jobId = routeParam(req.params.id);
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
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, req.params.id as string), eq(jobs.customerId, req.user!.userId)));
    if (!job) return res.status(404).json({ error: "Job not found" });
    const closeJobId = req.params.id as string;
    await db.update(jobs).set({
      status: "CLOSED", blockedRepost: blockRepost ? true : false, updatedAt: new Date()
    }).where(eq(jobs.id, closeJobId));
    // Archive all conversations linked to this job
    await db.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, closeJobId));
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

      // Moderate quote message — phone never allowed in quote text
      if (message) {
        const quoteMod = moderateText(message, { fieldName: "quote message", surface: "quote", route: "POST /api/quotes", userId: proId });
        if (quoteMod.blocked) {
          if (quoteMod.logEntry) console.warn("[MODERATION BLOCK]", JSON.stringify(quoteMod.logEntry));
          return res.status(422).json({ error: quoteMod.userMessage });
        }
      }

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
    try {
      const userId = req.user!.userId;
      const [userRow] = await db.select().from(users).where(eq(users.id, userId));
      if (!userRow) return res.status(404).json({ error: "User not found" });

      let conditions: any[] = [];
      if (userRow.role === "CUSTOMER") conditions.push(eq(quotes.customerId, userId));
      else conditions.push(eq(quotes.professionalId, userId));

      const rawQuotes = await db.select().from(quotes).where(and(...conditions)).orderBy(desc(quotes.createdAt));

      // Enrich with job + category + conversation
      const enriched = await Promise.all(rawQuotes.map(async (q) => {
        const [job] = await db.select({ id: jobs.id, title: jobs.title, status: jobs.status, categoryId: jobs.categoryId, referenceCode: jobs.referenceCode })
          .from(jobs).where(eq(jobs.id, q.jobId));
        const [cat] = job?.categoryId
          ? await db.select({ name: serviceCategories.name }).from(serviceCategories).where(eq(serviceCategories.id, job.categoryId))
          : [null];
        const [conv] = await db.select({ id: conversations.id }).from(conversations)
          .where(and(eq(conversations.jobId, q.jobId)))
          .limit(1);
        return { ...q, job: job || null, category: cat || null, conversationId: conv?.id || null };
      }));

      // For professionals: separate active quotes from archived (closed/completed jobs)
      if (userRow.role === "PROFESSIONAL") {
        const activeStatuses = ["LIVE", "IN_DISCUSSION", "MATCHED", "BOOSTED"];
        const active = enriched.filter(q => q.job && activeStatuses.includes(q.job.status));
        const archived = enriched.filter(q => !q.job || !activeStatuses.includes(q.job.status));
        return res.json({ quotes: active, archived });
      }

      return res.json(enriched);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/quotes/:id/accept", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, req.params.id as string));
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });

      await db.transaction(async (tx) => {
        await tx.update(quotes).set({ status: "ACCEPTED", updatedAt: new Date() }).where(eq(quotes.id, quote.id));

        const [booking] = await tx.insert(bookings).values({
          quoteId: quote.id, jobId: quote.jobId,
          customerId: quote.customerId, professionalId: quote.professionalId,
          totalAmount: quote.amount, status: "CONFIRMED"
        }).returning();

        await tx.update(jobs).set({ status: "MATCHED", updatedAt: new Date() }).where(eq(jobs.id, quote.jobId));

        // Auto-reject all other pending quotes for this job
        await tx.update(quotes)
          .set({ status: "REJECTED", updatedAt: new Date() })
          .where(and(
            eq(quotes.jobId, quote.jobId),
            eq(quotes.status, "PENDING"),
            ne(quotes.id, quote.id)
          ));
      });

      await createNotification(quote.professionalId, "QUOTE_ACCEPTED", "Your quote was accepted!",
        "The customer has accepted your quote.", { quoteId: quote.id, jobId: quote.jobId });

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/quotes/:id/reject", requireAuth, async (req: AuthRequest, res: Response) => {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, req.params.id as string));
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
    
    const rawBookings = await db.select().from(bookings).where(and(...conditions)).orderBy(desc(bookings.createdAt));
    
    // Enrich bookings with nested Job, User, and Conversation data
    const enrichedBookings = await Promise.all(rawBookings.map(async (b) => {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, b.jobId));
      const [customer] = await db.select().from(users).where(eq(users.id, b.customerId));
      const [professional] = await db.select().from(users).where(eq(users.id, b.professionalId));
      // Find the conversation linked to this job so chat buttons can deep-link
      const [conv] = await db.select({ id: conversations.id }).from(conversations)
        .where(eq(conversations.jobId, b.jobId)).limit(1);
      return {
        ...b,
        job,
        conversationId: conv?.id || null,
        customer: customer ? { id: customer.id, firstName: customer.firstName, lastName: customer.lastName, avatarUrl: customer.avatarUrl, phone: customer.phone } : null,
        professional: professional ? { id: professional.id, firstName: professional.firstName, lastName: professional.lastName, businessName: null } : null
      };
    }));

    return res.json(enrichedBookings);
  });

  app.post("/api/bookings/:id/in-progress", requireAuth, async (req: AuthRequest, res: Response) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id as string));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.professionalId !== req.user!.userId) {
      return res.status(403).json({ error: "Forbidden. Only the assigned professional can mark this in progress." });
    }
    await db.update(bookings).set({ status: "IN_PROGRESS", updatedAt: new Date() })
      .where(eq(bookings.id, req.params.id as string));
    return res.json({ success: true });
  });

  app.get("/api/bookings/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id as string));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const userId = req.user!.userId;
    if (booking.customerId !== userId && booking.professionalId !== userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(booking);
  });

  app.post("/api/bookings/:id/complete", requireAuth, async (req: AuthRequest, res: Response) => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id as string));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.customerId !== req.user!.userId && booking.professionalId !== req.user!.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.update(bookings).set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(bookings.id, req.params.id as string));
    await db.update(jobs).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(jobs.id, booking.jobId));
    // Archive all conversations linked to this job
    await db.update(conversations).set({ status: "ARCHIVED" }).where(eq(conversations.jobId, booking.jobId));
    return res.json({ success: true });
  });

  app.post("/api/bookings/:id/cancel", requireAuth, async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id as string));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    await db.update(bookings).set({
      status: "CANCELLED", cancellationReason: reason || null, updatedAt: new Date()
    }).where(eq(bookings.id, req.params.id as string));
    return res.json({ success: true });
  });

  app.post("/api/bookings/:id/review", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { rating, title, comment } = req.body;
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.params.id as string));
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // Moderate review text — block phone numbers, profanity, contact attempts
      if (comment) {
        const commentMod = moderateText(comment, { fieldName: "review comment" });
        if (commentMod.blocked) {
          return res.status(422).json({ error: commentMod.userMessage });
        }
      }
      if (title) {
        const titleMod = moderateText(title, { fieldName: "review title" });
        if (titleMod.blocked) {
          return res.status(422).json({ error: titleMod.userMessage });
        }
      }

      const reviewerId = req.user!.userId;
      // Reviews always go TO the professional (the reviewee)
      const revieweeId = booking.professionalId;

      // Prevent duplicate reviews
      const existingReview = await db.select({ id: reviews.id }).from(reviews)
        .where(and(eq(reviews.bookingId, booking.id), eq(reviews.reviewerId, reviewerId)));
      if (existingReview.length > 0) {
        return res.status(409).json({ error: "You have already reviewed this booking." });
      }

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
  // CALL REQUESTS (replaces phone sharing)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Create a call request
  app.post("/api/call-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { targetId, jobId, bookingId, reason } = req.body;

      if (!targetId) return res.status(400).json({ error: "Target user is required" });

      // Check if there's already a pending call request
      const [existing] = await db.select().from(callRequests)
        .where(and(
          eq(callRequests.requesterId, userId),
          eq(callRequests.targetId, targetId),
          eq(callRequests.status, "PENDING")
        ));
      if (existing) return res.status(409).json({ error: "You already have a pending call request with this user" });

      // Create the call request (expires in 24 hours)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [callReq] = await db.insert(callRequests).values({
        requesterId: userId,
        targetId,
        jobId: jobId || null,
        bookingId: bookingId || null,
        reason: reason || "Would like to discuss the project",
        expiresAt,
      }).returning();

      // Get requester name for notification
      const [requester] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, userId));

      await createNotification(targetId, "CALL_REQUEST", "📞 Call request received",
        `${requester.firstName} ${requester.lastName} would like to have a call with you: "${reason || "Discuss the project"}"`,
        { callRequestId: callReq.id, requesterId: userId, jobId, bookingId });

      // Get target user name for call_ready payload
      const [targetUser] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, targetId));

      const requesterName = `${requester.firstName} ${requester.lastName}`;
      const targetName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : "User";

      // Fire call_ready to both parties to kick off the WebRTC flow immediately.
      // Caller receives role=caller and starts the offer; callee receives role=callee and shows RINGING.
      await pusher.trigger(`private-user-${userId}`, "call_ready", {
        role: "caller",
        from: targetId,
        name: targetName,
      });
      await pusher.trigger(`private-user-${targetId}`, "call_ready", {
        role: "callee",
        from: userId,
        name: requesterName,
      });

      return res.status(201).json(callReq);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Respond to a call request (accept/decline)
  app.patch("/api/call-requests/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { status } = req.body;
      
      if (!["ACCEPTED", "DECLINED"].includes(status)) {
        return res.status(400).json({ error: "Status must be ACCEPTED or DECLINED" });
      }

      const [callReq] = await db.select().from(callRequests).where(eq(callRequests.id, req.params.id as string));
      if (!callReq) return res.status(404).json({ error: "Call request not found" });
      if (callReq.targetId !== userId) return res.status(403).json({ error: "Not authorized" });
      if (callReq.status !== "PENDING") return res.status(409).json({ error: "Call request already responded to" });

      const [updated] = await db.update(callRequests)
        .set({ status: status as any, respondedAt: new Date() })
        .where(eq(callRequests.id, callReq.id))
        .returning();

      // Get responder name
      const [responder] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, userId));

      if (status === "ACCEPTED") {
        await createNotification(callReq.requesterId, "CALL_ACCEPTED", "✅ Call request accepted",
          `${responder.firstName} ${responder.lastName} accepted your call request! You can now coordinate a call time through in-app chat.`,
          { callRequestId: callReq.id });
      } else {
        await createNotification(callReq.requesterId, "CALL_DECLINED", "Call request declined",
          `${responder.firstName} ${responder.lastName} declined your call request. You can continue communicating via in-app chat.`,
          { callRequestId: callReq.id });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // List call requests for current user
  app.get("/api/call-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const sent = await db.select().from(callRequests)
        .where(eq(callRequests.requesterId, userId))
        .orderBy(desc(callRequests.createdAt));
      const received = await db.select().from(callRequests)
        .where(eq(callRequests.targetId, userId))
        .orderBy(desc(callRequests.createdAt));

      // Enrich with user info
      const enrichSent = await Promise.all(sent.map(async (cr) => {
        const [target] = await db.select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
          .from(users).where(eq(users.id, cr.targetId));
        return { ...cr, target };
      }));

      const enrichReceived = await Promise.all(received.map(async (cr) => {
        const [requester] = await db.select({ firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl })
          .from(users).where(eq(users.id, cr.requesterId));
        return { ...cr, requester };
      }));

      return res.json({ sent: enrichSent, received: enrichReceived });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/chat/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const myConvs = await db.select({ conv: conversations, lastReadAt: conversationParticipants.lastReadAt })
        .from(conversationParticipants)
        .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
        .where(eq(conversationParticipants.userId, userId))
        .orderBy(desc(conversations.lastMessageAt));

      const result = await Promise.all(myConvs.map(async ({ conv, lastReadAt }) => {
        const participants = await db.select({
          id: users.id, firstName: users.firstName, lastName: users.lastName,
          avatarUrl: users.avatarUrl, role: users.role
        }).from(conversationParticipants)
          .innerJoin(users, eq(conversationParticipants.userId, users.id))
          .where(eq(conversationParticipants.conversationId, conv.id));

        const [lastMsg] = await db.select().from(messages)
          .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
          .orderBy(desc(messages.createdAt)).limit(1);

        // Count only messages after lastReadAt (true unread count)
        const unreadConditions = [
          eq(messages.conversationId, conv.id),
          ne(messages.senderId, userId),
          isNull(messages.deletedAt),
          ...(lastReadAt ? [gt(messages.createdAt, lastReadAt)] : [])
        ];
        const [unreadResult] = await db.select({ c: count() }).from(messages).where(and(...unreadConditions));

        let jobData: { title: string; status: string } | null = null;
        if (conv.jobId) {
          const [j] = await db.select({ title: jobs.title, status: jobs.status }).from(jobs).where(eq(jobs.id, conv.jobId));
          jobData = j || null;
        }

        // Compute the other participant's display name
        const other = participants.find(p => p.id !== userId);
        const otherName = other ? `${other.firstName} ${other.lastName}`.trim() : "Unknown";

        return {
          ...conv,
          // Flatten for easy frontend use
          jobTitle: jobData?.title || otherName,
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.createdAt || conv.lastMessageAt,
          unreadCount: unreadResult?.c ?? 0,
          // Full objects also available
          participants,
          job: jobData,
        };
      }));

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/chat/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const convId = req.params.id as string;
      const { limit, offset } = safePagination(req.query as any, { page: 1, limit: 50, maxLimit: 200 });

      const [participant] = await db.select().from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, userId)));
      if (!participant) return res.status(403).json({ error: "Not a participant in this conversation" });

      const rawMsgs = await db.select().from(messages)
        .where(and(eq(messages.conversationId, convId), isNull(messages.deletedAt)))
        .orderBy(asc(messages.createdAt))
        .limit(limit).offset(offset);

      // Enrich messages with sender names
      const senderCache = new Map<string, { firstName: string; lastName: string; role: string }>();
      const enrichedMsgs = await Promise.all(rawMsgs.map(async (msg) => {
        if (!senderCache.has(msg.senderId)) {
          const [sender] = await db.select({
            firstName: users.firstName, lastName: users.lastName, role: users.role
          }).from(users).where(eq(users.id, msg.senderId));
          if (sender) senderCache.set(msg.senderId, sender);
        }
        const sender = senderCache.get(msg.senderId);
        return {
          ...msg,
          senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() : "System",
          senderRole: sender?.role || "SYSTEM",
        };
      }));

      // Mark as read
      await db.update(conversationParticipants).set({ lastReadAt: new Date() })
        .where(and(eq(conversationParticipants.conversationId, req.params.id as string), eq(conversationParticipants.userId, userId)));

      return res.json(enrichedMsgs);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const convId = req.params.id as string;
      const { content, type = "TEXT" } = req.body;

      const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
      if (!conv) return res.status(404).json({ error: "Conversation not found" });

      const [participant] = await db.select().from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, convId), eq(conversationParticipants.userId, userId)));
      if (!participant) return res.status(403).json({ error: "Not a participant" });

      // Phone sharing: only allowed when the sender is a pro with a STANDARD-tier unlock
      // (phoneUnlocked=true) for the job linked to this conversation.
      let allowPhone = false;
      if (conv.jobId) {
        const [stdUnlock] = await db.select({ id: jobUnlocks.id, phoneUnlocked: jobUnlocks.phoneUnlocked })
          .from(jobUnlocks)
          .where(and(
            eq(jobUnlocks.jobId, conv.jobId),
            eq(jobUnlocks.professionalId, userId),
            eq(jobUnlocks.tier, "STANDARD"),
            eq(jobUnlocks.phoneUnlocked, true)
          ));
        if (stdUnlock) allowPhone = true;
      }

      // Run unified moderation — blocks if phone detected and not allowed
      const chatMod = moderateText(content, {
        allowPhone,
        fieldName: "message",
        route: "POST /api/chat/conversations/:id/messages",
        surface: "chat",
        userId,
        userRole: req.user!.role,
        referenceId: convId,
      });
      if (chatMod.blocked) {
        // Structured logging for admin visibility
        if (chatMod.logEntry) {
          console.warn("[MODERATION BLOCK]", JSON.stringify(chatMod.logEntry));
          // Also create an admin audit log — use the acting user's ID as adminId
          // since "system" is not a valid user reference
          try {
            await db.insert(adminAuditLogs).values({
              adminId: userId,
              action: "MODERATION_BLOCK",
              resourceType: "message",
              resourceId: convId,
              changes: {
                blocked: true,
                reason: chatMod.reason,
                flags: chatMod.flags,
                confidence: chatMod.logEntry.confidence,
                reconstructedDigits: chatMod.logEntry.reconstructedDigits,
                normalizedText: chatMod.logEntry.normalizedText.substring(0, 500),
                originalText: chatMod.logEntry.originalText.substring(0, 500),
              },
              ipAddress: (req as any).ip || "unknown",
            });
          } catch (_logErr) {
            // logging failure is non-blocking
          }
        }
        return res.status(422).json({ error: chatMod.userMessage });
      }

      // Use existing pipeline for flagging/storage metadata (severity, flags)
      let { content: processedContent, originalContent, isFiltered, filterFlags, severity, profanityCount, contactCount } = processMessageContent(chatMod.cleanedText, !allowPhone);

      // NER Layer 2: If regex found no contacts, run HuggingFace NER
      // to catch obfuscated contact-sharing (spoken numbers, social handles, etc.)
      if (contactCount === 0 && process.env.HUGGINGFACE_API_KEY) {
        try {
          const nerResult = await nerMaskObfuscated(processedContent, process.env.HUGGINGFACE_API_KEY);
          if (nerResult.caught) {
            processedContent = nerResult.masked;
            isFiltered = true;
            filterFlags = [...filterFlags, ...nerResult.flags];
          }
        } catch (_nerErr) {
          // NER failure is non-blocking — message still sends
        }
      }

      const [msg] = await db.insert(messages).values({
        conversationId: convId, senderId: userId, type: type as any,
        content: processedContent,
        originalContent: originalContent || undefined,
        isFiltered, filterFlags
      }).returning();

      await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, req.params.id as string));

      // Severity-based auto-flagging for admin attention
      if (severity === "CRITICAL") {
        // Hate speech / slurs — immediate admin alert
        await createNotification("admin", "MESSAGE_FLAGGED", "🚨 Hate speech detected",
          `Critical content flagged for immediate review (${profanityCount} violations)`, { messageId: msg.id, conversationId: convId, severity: "CRITICAL" });
      } else if (severity === "SEVERE" || (isFiltered && filterFlags.length >= 2)) {
        // Strong profanity or multiple filter hits — standard moderation
        await createNotification("admin", "MESSAGE_FLAGGED", "Message flagged for review",
          `Auto-flagged: ${filterFlags.join(", ")}`, { messageId: msg.id, conversationId: convId, severity: severity || "INFO" });
      }
      
      // Notify user if contact info was blocked
      if (contactCount > 0) {
        await createNotification(userId, "SYSTEM", "Contact sharing blocked",
          "Phone numbers, emails, and social media handles are not allowed in messages. Please use in-app messaging to communicate.", {});
      }

      // Emit via Pusher real-time channel
      pusher.trigger(`private-conversation-${convId}`, "new_message", msg).catch(err =>
        console.error("Pusher trigger error (message):", err)
      );

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
    try {
      const userId = req.user!.userId;
      const myParticipations = await db.select({
        convId: conversationParticipants.conversationId,
        lastReadAt: conversationParticipants.lastReadAt
      }).from(conversationParticipants).where(eq(conversationParticipants.userId, userId));

      if (myParticipations.length === 0) return res.json({ count: 0 });

      // Sum unread counts per conversation (respecting lastReadAt)
      let totalUnread = 0;
      for (const p of myParticipations) {
        const conditions = [
          eq(messages.conversationId, p.convId),
          ne(messages.senderId, userId),
          isNull(messages.deletedAt),
          ...(p.lastReadAt ? [gt(messages.createdAt, p.lastReadAt)] : [])
        ];
        const [r] = await db.select({ c: count() }).from(messages).where(and(...conditions));
        totalUnread += r?.c ?? 0;
      }
      return res.json({ count: totalUnread });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/chat/conversations/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await db.update(conversationParticipants).set({ lastReadAt: new Date() })
        .where(and(
          eq(conversationParticipants.conversationId, routeParam(req.params.id)),
          eq(conversationParticipants.userId, req.user!.userId)
        ));
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
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
    const { limit, offset } = safePagination(req.query as any, { page: 1, limit: 50, maxLimit: 100 });
    const notifs = await db.select().from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit).offset(offset);
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
      .where(and(eq(notifications.id, routeParam(req.params.id)), eq(notifications.userId, req.user!.userId)));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT TICKETS — COMPLETE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  // SLA deadlines by priority (hours from creation)
  const SLA_HOURS: Record<string, number> = { LOW: 72, MEDIUM: 48, HIGH: 24, URGENT: 4 };

  // Helper: calculate SLA deadline
  function calcSlaDeadline(priority: string): Date {
    const hours = SLA_HOURS[priority] || 48;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // Helper: auto-assign ticket to least-loaded support staff
  async function autoAssignTicket(): Promise<string | null> {
    const supportStaff = await db.select({ id: users.id }).from(users)
      .where(or(eq(users.role, "ADMIN"), eq(users.role, "SUPPORT"))!);
    if (supportStaff.length === 0) return null;
    // Find who has the fewest open tickets
    const loads = await Promise.all(supportStaff.map(async (s) => {
      const [result] = await db.select({ c: count() }).from(supportTickets)
        .where(and(eq(supportTickets.assignedTo, s.id), or(eq(supportTickets.status, "OPEN"), eq(supportTickets.status, "IN_PROGRESS"))!));
      return { id: s.id, count: Number(result?.c || 0) };
    }));
    loads.sort((a, b) => a.count - b.count);
    return loads[0]?.id || null;
  }

  // Create support ticket
  app.post("/api/support/tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { subject, description, message, category, priority } = req.body;
      if (!subject) return res.status(400).json({ error: "Subject is required" });
      const ticketDescription = description || message || null;
      if (!ticketDescription) return res.status(400).json({ error: "Description is required" });

      // Moderate support ticket text — block phone/contact in descriptions
      const descMod = moderateText(ticketDescription, { fieldName: "ticket description" });
      if (descMod.blocked) return res.status(422).json({ error: descMod.userMessage });
      const subjMod = moderateText(subject, { fieldName: "ticket subject" });
      if (subjMod.blocked) return res.status(422).json({ error: subjMod.userMessage });

      const ticketPriority = priority || "MEDIUM";
      const assignee = await autoAssignTicket();
      const [ticket] = await db.insert(supportTickets).values({
        userId: req.user!.userId, subject, description: ticketDescription,
        category: category || "GENERAL", priority: ticketPriority,
        assignedTo: assignee, slaDeadline: calcSlaDeadline(ticketPriority)
      }).returning();
      // Notify support staff
      await createNotification("admin", "NEW_TICKET", "New support ticket",
        `${subject} — Priority: ${ticketPriority}`, { ticketId: ticket.id });
      return res.status(201).json(ticket);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // List tickets (role-based)
  app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    let conditions: any[] = [];
    if (user.role !== "ADMIN" && user.role !== "SUPPORT") conditions.push(eq(supportTickets.userId, userId));
    // Optional query filters
    const { status, priority: pFilter, category: cFilter } = req.query as Record<string, string>;
    if (status && status !== "all") conditions.push(eq(supportTickets.status, status as any));
    if (pFilter && pFilter !== "all") conditions.push(eq(supportTickets.priority, pFilter as any));
    if (cFilter && cFilter !== "all") conditions.push(eq(supportTickets.category, cFilter));
    const tickets = await db.select().from(supportTickets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt));
    // Enrich with user info and message count
    const enriched = await Promise.all(tickets.map(async (t) => {
      const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role })
        .from(users).where(eq(users.id, t.userId));
      const [msgCount] = await db.select({ c: count() }).from(ticketMessages)
        .where(and(eq(ticketMessages.ticketId, t.id), eq(ticketMessages.isInternal, false)));
      const isOverdue = t.slaDeadline && new Date(t.slaDeadline) < new Date() && !["RESOLVED", "CLOSED"].includes(t.status);
      return { ...t, userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
        userEmail: user?.email, userRole: user?.role, messageCount: Number(msgCount?.c || 0), isOverdue };
    }));
    return res.json(enriched);
  });

  // Get single ticket with messages and sender info
  app.get("/api/support/tickets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, routeParam(req.params.id)));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    // Verify access: user owns ticket or is admin/support
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId));
    if (user.role !== "ADMIN" && user.role !== "SUPPORT" && ticket.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const rawMsgs = await db.select().from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticket.id)).orderBy(asc(ticketMessages.createdAt));
    // Enrich messages with sender names
    const msgs = await Promise.all(rawMsgs.map(async (m) => {
      const [sender] = await db.select({ firstName: users.firstName, lastName: users.lastName, role: users.role })
        .from(users).where(eq(users.id, m.senderId));
      return { ...m, senderName: sender ? `${sender.firstName} ${sender.lastName}` : "System",
        senderRole: sender?.role || "SYSTEM", isStaff: sender?.role === "ADMIN" || sender?.role === "SUPPORT" };
    }));
    // Filter internal notes from non-staff
    const filteredMsgs = (user.role === "ADMIN" || user.role === "SUPPORT")
      ? msgs : msgs.filter(m => !m.isInternal);
    // Ticket creator info
    const [creator] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role })
      .from(users).where(eq(users.id, ticket.userId));
    // Assignee info
    let assigneeName = null;
    if (ticket.assignedTo) {
      const [assignee] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, ticket.assignedTo));
      assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : null;
    }
    const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && !["RESOLVED", "CLOSED"].includes(ticket.status);
    return res.json({
      ...ticket, messages: filteredMsgs, isOverdue,
      userName: creator ? `${creator.firstName} ${creator.lastName}` : "Unknown",
      userEmail: creator?.email, userRole: creator?.role, assigneeName
    });
  });

  // Add message to ticket (any authenticated user who owns or is staff)
  app.post("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    const { message, isInternal } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

    // Moderate ticket message content (staff internal notes skip moderation)
    const [sender] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId));
    const isStaff = sender?.role === "ADMIN" || sender?.role === "SUPPORT";
    if (!isStaff) {
      const msgMod = moderateText(message, { fieldName: "message" });
      if (msgMod.blocked) return res.status(422).json({ error: msgMod.userMessage });
    }

    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    // Only staff can post internal notes
    const internal = isInternal && isStaff ? true : false;
    const [msg] = await db.insert(ticketMessages).values({
      ticketId: ticket.id as string, senderId: req.user!.userId, message: message.trim(), isInternal: internal
    }).returning();
    // Track first response time for SLA
    const updateFields: any = { updatedAt: new Date() };
    if (isStaff && !ticket.firstResponseAt) {
      updateFields.firstResponseAt = new Date();
    }
    // Auto-set status to IN_PROGRESS if staff replies to OPEN ticket
    if (isStaff && ticket.status === "OPEN") {
      updateFields.status = "IN_PROGRESS";
    }
    // If customer replies to WAITING ticket, set back to IN_PROGRESS
    if (!isStaff && ticket.status === "WAITING") {
      updateFields.status = "IN_PROGRESS";
    }
    await db.update(supportTickets).set(updateFields).where(eq(supportTickets.id, ticket.id as string));
    // Notify the other party
    if (isStaff && !internal) {
      await createNotification(ticket.userId, "TICKET_REPLY", "Support reply",
        `New reply on: ${ticket.subject}`, { ticketId: ticket.id });
    } else if (!isStaff) {
      await createNotification("admin", "TICKET_CUSTOMER_REPLY", "Customer replied",
        `Reply on: ${ticket.subject}`, { ticketId: ticket.id });
    }
    return res.status(201).json({ ...msg, isStaff });
  });

  // Update ticket (admin/support only)
  app.patch("/api/support/tickets/:id", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    const { status, priority, assignedTo } = req.body;
    const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
    if (!existing) return res.status(404).json({ error: "Ticket not found" });
    const updateFields: any = { updatedAt: new Date() };
    if (status) updateFields.status = status;
    if (priority) {
      updateFields.priority = priority;
      updateFields.slaDeadline = calcSlaDeadline(priority);
    }
    if (assignedTo !== undefined) updateFields.assignedTo = assignedTo || null;
    if (status === "RESOLVED") updateFields.resolvedAt = new Date();
    if (status === "CLOSED") updateFields.closedAt = new Date();
    const [ticket] = await db.update(supportTickets).set(updateFields)
      .where(eq(supportTickets.id, req.params.id as string)).returning();
    // Notify customer of status change
    if (status && status !== existing.status) {
      await createNotification(existing.userId, "TICKET_STATUS", "Ticket updated",
        `Your ticket "${existing.subject}" is now ${status}`, { ticketId: existing.id });
    }
    // Audit log
    await db.insert(adminAuditLogs).values({
      adminId: req.user!.userId, action: "UPDATE_TICKET", resourceType: "SUPPORT_TICKET",
      resourceId: req.params.id as string, changes: { status, priority, assignedTo },
      ipAddress: req.ip
    });
    return res.json(ticket);
  });

  // Customer rates a resolved ticket (satisfaction survey)
  app.post("/api/support/tickets/:id/rate", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.userId !== req.user!.userId) return res.status(403).json({ error: "Not your ticket" });
      if (!["RESOLVED", "CLOSED"].includes(ticket.status)) return res.status(400).json({ error: "Ticket must be resolved first" });
      if (ticket.satisfactionRating) return res.status(409).json({ error: "Already rated" });
      const [updated] = await db.update(supportTickets).set({
        satisfactionRating: rating, satisfactionComment: comment?.trim() || null, ratedAt: new Date()
      }).where(eq(supportTickets.id, req.params.id as string)).returning();
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Customer reopens a resolved/closed ticket
  app.post("/api/support/tickets/:id/reopen", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.userId !== req.user!.userId) return res.status(403).json({ error: "Not your ticket" });
      if (!["RESOLVED", "CLOSED"].includes(ticket.status)) return res.status(400).json({ error: "Ticket is not resolved/closed" });
      if (ticket.reopenCount >= 3) return res.status(400).json({ error: "Maximum reopens reached. Please create a new ticket." });
      const [updated] = await db.update(supportTickets).set({
        status: "OPEN", reopenedAt: new Date(), reopenCount: ticket.reopenCount + 1,
        resolvedAt: null, closedAt: null, satisfactionRating: null, satisfactionComment: null, ratedAt: null,
        slaDeadline: calcSlaDeadline(ticket.priority), updatedAt: new Date()
      }).where(eq(supportTickets.id, req.params.id as string)).returning();
      // Add reopen reason as message
      if (reason?.trim()) {
        await db.insert(ticketMessages).values({
          ticketId: ticket.id as string, senderId: req.user!.userId,
          message: `[Ticket reopened] ${reason.trim()}`
        });
      }
      await createNotification("admin", "TICKET_REOPENED", "Ticket reopened",
        `"${ticket.subject}" was reopened by customer`, { ticketId: ticket.id });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Escalate ticket (admin/support)
  app.post("/api/support/tickets/:id/escalate", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      // Bump priority up one level
      const levels = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      const currentIdx = levels.indexOf(ticket.priority);
      const newPriority = currentIdx < levels.length - 1 ? levels[currentIdx + 1] : "URGENT";
      const [updated] = await db.update(supportTickets).set({
        priority: newPriority as any, escalatedAt: new Date(), escalatedTo: req.user!.userId,
        slaDeadline: calcSlaDeadline(newPriority), updatedAt: new Date()
      }).where(eq(supportTickets.id, req.params.id as string)).returning();
      // Add system message
      await db.insert(ticketMessages).values({
        ticketId: ticket.id as string, senderId: req.user!.userId,
        message: `[Escalated] Priority changed from ${ticket.priority} to ${newPriority}`,
        isInternal: true
      });
      await createNotification("admin", "TICKET_ESCALATED", "Ticket escalated",
        `"${ticket.subject}" escalated to ${newPriority}`, { ticketId: ticket.id });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Support analytics (admin only)
  app.get("/api/support/analytics", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const [totalTickets] = await db.select({ c: count() }).from(supportTickets);
      const [openTickets] = await db.select({ c: count() }).from(supportTickets)
        .where(or(eq(supportTickets.status, "OPEN"), eq(supportTickets.status, "IN_PROGRESS"))!);
      const [resolvedTickets] = await db.select({ c: count() }).from(supportTickets)
        .where(eq(supportTickets.status, "RESOLVED"));
      const [closedTickets] = await db.select({ c: count() }).from(supportTickets)
        .where(eq(supportTickets.status, "CLOSED"));
      const [waitingTickets] = await db.select({ c: count() }).from(supportTickets)
        .where(eq(supportTickets.status, "WAITING"));
      // Overdue count
      const [overdueTickets] = await db.select({ c: count() }).from(supportTickets)
        .where(and(
          lt(supportTickets.slaDeadline, new Date()),
          or(eq(supportTickets.status, "OPEN"), eq(supportTickets.status, "IN_PROGRESS"))!
        ));
      // Average satisfaction
      const [avgSat] = await db.select({ avg: avg(supportTickets.satisfactionRating) }).from(supportTickets)
        .where(isNotNull(supportTickets.satisfactionRating));
      // By category
      const byCat = await db.select({ category: supportTickets.category, c: count() }).from(supportTickets)
        .groupBy(supportTickets.category);
      // By priority
      const byPriority = await db.select({ priority: supportTickets.priority, c: count() }).from(supportTickets)
        .groupBy(supportTickets.priority);
      // Recent 7 days trend
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [recentCreated] = await db.select({ c: count() }).from(supportTickets)
        .where(gte(supportTickets.createdAt, sevenDaysAgo));
      const [recentResolved] = await db.select({ c: count() }).from(supportTickets)
        .where(and(isNotNull(supportTickets.resolvedAt), gte(supportTickets.resolvedAt, sevenDaysAgo)));

      return res.json({
        total: Number(totalTickets?.c || 0),
        open: Number(openTickets?.c || 0),
        resolved: Number(resolvedTickets?.c || 0),
        closed: Number(closedTickets?.c || 0),
        waiting: Number(waitingTickets?.c || 0),
        overdue: Number(overdueTickets?.c || 0),
        avgSatisfaction: avgSat?.avg ? parseFloat(String(avgSat.avg)) : null,
        byCategory: byCat.map(r => ({ category: r.category, count: Number(r.c) })),
        byPriority: byPriority.map(r => ({ priority: r.priority, count: Number(r.c) })),
        last7Days: { created: Number(recentCreated?.c || 0), resolved: Number(recentResolved?.c || 0) }
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAQ / KNOWLEDGE BASE
  // ═══════════════════════════════════════════════════════════════════════════

  // Public: list published FAQ articles
  app.get("/api/support/faq", async (req: Request, res: Response) => {
    try {
      const { category } = req.query as Record<string, string>;
      let conditions: any[] = [eq(faqArticles.isPublished, true)];
      if (category && category !== "all") conditions.push(eq(faqArticles.category, category));
      const articles = await db.select().from(faqArticles)
        .where(and(...conditions))
        .orderBy(asc(faqArticles.sortOrder), desc(faqArticles.createdAt));
      return res.json(articles);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Vote FAQ helpfulness
  app.post("/api/support/faq/:id/vote", async (req: Request, res: Response) => {
    try {
      const { helpful } = req.body;
      const field = helpful ? faqArticles.helpfulCount : faqArticles.notHelpfulCount;
      const [article] = await db.update(faqArticles).set({
        [helpful ? "helpfulCount" : "notHelpfulCount"]: sql`${field} + 1`
      }).where(eq(faqArticles.id, routeParam(req.params.id))).returning();
      return res.json(article);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // Admin: CRUD for FAQ articles
  app.get("/api/admin/support/faq", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    const articles = await db.select().from(faqArticles).orderBy(asc(faqArticles.sortOrder), desc(faqArticles.createdAt));
    return res.json(articles);
  });

  app.post("/api/admin/support/faq", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const { question, answer, category, sortOrder, isPublished } = req.body;
      if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: "Question and answer required" });
      const [article] = await db.insert(faqArticles).values({
        question: question.trim(), answer: answer.trim(), category: category || "GENERAL",
        sortOrder: sortOrder || 0, isPublished: isPublished !== false, createdBy: req.user!.userId
      }).returning();
      return res.status(201).json(article);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/support/faq/:id", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const { question, answer, category, sortOrder, isPublished } = req.body;
      const [article] = await db.update(faqArticles).set({
        question, answer, category, sortOrder, isPublished, updatedAt: new Date()
      }).where(eq(faqArticles.id, routeParam(req.params.id))).returning();
      return res.json(article);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/support/faq/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    await db.delete(faqArticles).where(eq(faqArticles.id, routeParam(req.params.id)));
    return res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CANNED RESPONSES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/support/canned-responses", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    const responses = await db.select().from(cannedResponses).orderBy(asc(cannedResponses.category), desc(cannedResponses.usageCount));
    return res.json(responses);
  });

  app.post("/api/admin/support/canned-responses", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, category, shortcut } = req.body;
      if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: "Title and content required" });
      const [response] = await db.insert(cannedResponses).values({
        title: title.trim(), content: content.trim(), category: category || "GENERAL",
        shortcut: shortcut?.trim() || null, createdBy: req.user!.userId
      }).returning();
      return res.status(201).json(response);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/support/canned-responses/:id", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, category, shortcut } = req.body;
      const [response] = await db.update(cannedResponses).set({
        title, content, category, shortcut, updatedAt: new Date()
      }).where(eq(cannedResponses.id, routeParam(req.params.id))).returning();
      return res.json(response);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/support/canned-responses/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    await db.delete(cannedResponses).where(eq(cannedResponses.id, routeParam(req.params.id)));
    return res.json({ success: true });
  });

  // Track canned response usage
  app.post("/api/admin/support/canned-responses/:id/use", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    await db.update(cannedResponses).set({
      usageCount: sql`${cannedResponses.usageCount} + 1`
    }).where(eq(cannedResponses.id, routeParam(req.params.id)));
    return res.json({ success: true });
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

  // ── Pro Verification ─────────────────────────────────────────────────────────

  app.post("/api/pro/verification/submit", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const proId = req.user!.userId;
      const { documentUrl, licenseNumber } = req.body;
      if (!documentUrl) return res.status(400).json({ error: "Document URL is required" });

      const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, proId));
      if (!profile) return res.status(404).json({ error: "Professional profile not found" });
      if (profile.verificationStatus === "APPROVED") return res.status(409).json({ error: "Already verified" });

      await db.update(professionalProfiles).set({
        verificationStatus: "PENDING",
        verificationLevel: "SELF_DECLARED",
        verificationDocumentUrl: documentUrl,
        verificationSubmittedAt: new Date(),
        licenseNumber: licenseNumber || profile.licenseNumber,
        updatedAt: new Date()
      } as any).where(eq(professionalProfiles.userId, proId));

      await createNotification(proId, "VERIFICATION_SUBMITTED", "Verification submitted",
        "Your verification documents have been submitted and are pending admin review.", {});

      return res.json({ success: true, verificationStatus: "PENDING" });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/users/:id/verify", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { approved, note } = req.body as { approved: boolean; note?: string };
      const targetUserId = req.params.id as string;

      const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, targetUserId));
      if (!profile) return res.status(404).json({ error: "Professional profile not found" });

      const newStatus = approved ? "APPROVED" : "REJECTED";
      await db.update(professionalProfiles).set({
        isVerified: approved,
        verificationLevel: approved ? "DOCUMENT_VERIFIED" : "NONE",
        verificationStatus: newStatus,
        verificationReviewedAt: new Date(),
        verificationReviewNote: note || null,
        updatedAt: new Date()
      } as any).where(eq(professionalProfiles.userId, targetUserId));

      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: approved ? "VERIFY_PRO" : "REJECT_PRO",
        resourceType: "USER", resourceId: targetUserId as string,
        changes: { approved, note }, ipAddress: req.ip
      });

      const notifTitle = approved ? "Verification approved!" : "Verification not approved";
      const notifMsg = approved
        ? "Your professional account has been verified. You now have full access to the platform."
        : `Your verification was not approved. Reason: ${note || "Please resubmit with valid documents."}`;
      await createNotification(targetUserId, approved ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
        notifTitle, notifMsg, {});

      return res.json({ success: true, verificationStatus: newStatus });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/pro/:id/profile", async (req: Request, res: Response) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id as string));
    if (!user) return res.status(404).json({ error: "User not found" });
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, req.params.id as string));
    const targetProId = routeParam(req.params.id);
    const proReviews = await db.select().from(reviews).where(eq(reviews.revieweeId, targetProId)).limit(10);

    // Compute trust signals
    // Total hires = completed bookings as professional
    const [hiresRow] = await db.select({ c: count() }).from(bookings)
      .where(and(eq(bookings.professionalId, targetProId), eq(bookings.status, "COMPLETED")));
    const totalHires = hiresRow?.c ?? 0;

    // Avg response time in minutes — time between job created and first message from pro
    // Approximate: compute avg minutes between conversation creation and first pro message
    let avgResponseMinutes: number | null = null;
    try {
      const proConvs = await db.select({ id: conversations.id, createdAt: conversations.createdAt })
        .from(conversations)
        .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
        .where(eq(conversationParticipants.userId, targetProId))
        .limit(20);
      if (proConvs.length > 0) {
        const convIds = proConvs.map(c => c.id);
        const firstMsgs = await db.select({ convId: messages.conversationId, sentAt: messages.createdAt })
          .from(messages)
          .where(and(eq(messages.senderId, req.params.id as string), inArray(messages.conversationId, convIds)))
          .orderBy(messages.createdAt);
        if (firstMsgs.length > 0) {
          const deltas: number[] = [];
          for (const msg of firstMsgs) {
            const conv = proConvs.find(c => c.id === msg.convId);
            if (conv) deltas.push((new Date(msg.sentAt).getTime() - new Date(conv.createdAt).getTime()) / 60000);
          }
          if (deltas.length > 0) avgResponseMinutes = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        }
      }
    } catch (_) { /* non-blocking */ }

    // Public profile: strip sensitive fields (phone, email, passwordHash, internal IDs)
    // Phone is GDPR-sensitive and must not be exposed in public profiles
    const enrichedReviews = await Promise.all(proReviews.map(async (r) => {
      const [reviewer] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, r.reviewerId));
      return { ...r, reviewerFirstName: reviewer?.firstName || "Customer" };
    }));

    const safeProfile = profile ? {
      ...profile,
      // Strip sensitive verification docs from public view
      verificationDocumentUrl: undefined,
      verificationReviewNote: undefined,
    } : null;

    return res.json({
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      // No phone, no email, no internal ID, no passwordHash
      profile: safeProfile,
      reviews: enrichedReviews,
      totalHires,
      avgResponseMinutes,
    });
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
    const { role, status, search } = req.query as any;
    const { limit, offset } = safePagination(req.query as any);
    let conditions: any[] = [isNull(users.deletedAt)];
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));
    if (search) conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`))!);

    const result = await db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    const [{ c }] = await db.select({ c: count() }).from(users).where(and(...conditions));

    // Attach verification info for professionals
    const usersWithVerification = await Promise.all(result.map(async (u) => {
      if (u.role === "PROFESSIONAL") {
        const [profile] = await db.select({
          isVerified: professionalProfiles.isVerified,
          verificationStatus: professionalProfiles.verificationStatus,
          verificationDocumentUrl: professionalProfiles.verificationDocumentUrl,
          verificationSubmittedAt: professionalProfiles.verificationSubmittedAt,
          verificationReviewNote: professionalProfiles.verificationReviewNote,
        }).from(professionalProfiles).where(eq(professionalProfiles.userId, u.id));
        return { ...u, passwordHash: undefined, proVerification: profile || null };
      }
      return { ...u, passwordHash: undefined };
    }));

    return res.json({ users: usersWithVerification, total: c });
  });

  app.patch("/api/admin/users/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { status, role } = req.body;
    const targetUserId = routeParam(req.params.id);
    const [user] = await db.update(users).set({ status: status || undefined, role: role || undefined, updatedAt: new Date() })
      .where(eq(users.id, targetUserId)).returning();

    await db.insert(adminAuditLogs).values({
      adminId: req.user!.userId, action: "UPDATE_USER", resourceType: "USER",
      resourceId: targetUserId, changes: { status, role }, ipAddress: req.ip
    });

    return res.json({ ...user, passwordHash: undefined });
  });

  app.get("/api/admin/jobs", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    const { status, search } = req.query as any;
    const { limit, offset } = safePagination(req.query as any);
    let conditions: any[] = [];
    if (status) conditions.push(eq(jobs.status, status));
    if (search) conditions.push(or(ilike(jobs.title, `%${search}%`), ilike(jobs.locationText, `%${search}%`))!);
    const result = await db.select({
      id: jobs.id, title: jobs.title, description: jobs.description,
      customerId: jobs.customerId, categoryId: jobs.categoryId,
      budgetMin: jobs.budgetMin, budgetMax: jobs.budgetMax,
      locationText: jobs.locationText, urgency: jobs.urgency, status: jobs.status,
      creditCost: jobs.creditCost, isBoosted: jobs.isBoosted, boostCount: jobs.boostCount,
      aiQualityScore: jobs.aiQualityScore, aiIsFakeFlag: jobs.aiIsFakeFlag,
      aiIsUrgent: jobs.aiIsUrgent, createdAt: jobs.createdAt, updatedAt: jobs.updatedAt,
      customerName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${jobs.customerId})`,
    }).from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.createdAt)).limit(limit).offset(offset);
    const [{ c }] = await db.select({ c: count() }).from(jobs).where(conditions.length > 0 ? and(...conditions) : undefined);
    return res.json({ jobs: result, total: c });
  });

  // GET /api/admin/chat — flagged messages only (legacy)
  app.get("/api/admin/chat", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const flaggedMessages = await db.select({
        id: messages.id, conversationId: messages.conversationId, senderId: messages.senderId,
        content: messages.content, originalContent: messages.originalContent,
        filterFlags: messages.filterFlags, isFiltered: messages.isFiltered,
        createdAt: messages.createdAt,
        senderName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${messages.senderId})`,
        senderEmail: sql<string>`(select email from users where id = ${messages.senderId})`,
      }).from(messages)
        .where(and(eq(messages.isFiltered, true), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt)).limit(100);
      return res.json(flaggedMessages);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/conversations — all conversations with participant + job info
  app.get("/api/admin/conversations", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { search = "", status = "" } = req.query as any;
      const allConvs = await db.select().from(conversations)
        .orderBy(desc(conversations.lastMessageAt))
        .limit(200);

      const result = await Promise.all(allConvs.map(async (conv) => {
        const participants = await db.select({
          id: users.id, firstName: users.firstName, lastName: users.lastName,
          email: users.email, role: users.role
        }).from(conversationParticipants)
          .innerJoin(users, eq(conversationParticipants.userId, users.id))
          .where(eq(conversationParticipants.conversationId, conv.id));

        const [lastMsg] = await db.select({ content: messages.content, createdAt: messages.createdAt })
          .from(messages)
          .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
          .orderBy(desc(messages.createdAt)).limit(1);

        const [msgCount] = await db.select({ c: count() }).from(messages)
          .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)));

        const [flagCount] = await db.select({ c: count() }).from(messages)
          .where(and(eq(messages.conversationId, conv.id), eq(messages.isFiltered, true), isNull(messages.deletedAt)));

        let jobTitle: string | null = null;
        let jobStatus: string | null = null;
        if (conv.jobId) {
          const [j] = await db.select({ title: jobs.title, status: jobs.status }).from(jobs).where(eq(jobs.id, conv.jobId));
          jobTitle = j?.title || null;
          jobStatus = j?.status || null;
        }

        return {
          ...conv,
          jobTitle,
          jobStatus,
          participants,
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.createdAt || conv.lastMessageAt,
          messageCount: msgCount?.c ?? 0,
          flaggedCount: flagCount?.c ?? 0,
        };
      }));

      // Apply search filter in memory
      const filtered = result.filter(c => {
        if (search) {
          const s = (search as string).toLowerCase();
          const matchJob = c.jobTitle?.toLowerCase().includes(s);
          const matchParticipant = c.participants.some(
            (p: any) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)
          );
          if (!matchJob && !matchParticipant) return false;
        }
        if (status && c.status !== status) return false;
        return true;
      });

      return res.json(filtered);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/conversations/:id/messages — full thread for admin
  app.get("/api/admin/conversations/:id/messages", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const convId = req.params.id as string;
      const msgs = await db.select({
        id: messages.id, conversationId: messages.conversationId,
        senderId: messages.senderId, type: messages.type,
        content: messages.content, originalContent: messages.originalContent,
        isFiltered: messages.isFiltered, filterFlags: messages.filterFlags,
        createdAt: messages.createdAt, deletedAt: messages.deletedAt,
        senderName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${messages.senderId})`,
        senderRole: sql<string>`(select role from users where id = ${messages.senderId})`,
      }).from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(asc(messages.createdAt));
      return res.json(msgs);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/messages/:id/dismiss-flag — admin clears the filter flag
  app.patch("/api/admin/messages/:id/dismiss-flag", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const [msg] = await db.update(messages)
        .set({ isFiltered: false, filterFlags: [] })
        .where(eq(messages.id, req.params.id as string))
        .returning();
      return res.json(msg);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/messages/:id — admin hard-deletes a message
  app.delete("/api/admin/messages/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, req.params.id as string));
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
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
    }).where(eq(featureFlags.id, req.params.id as string)).returning();
    return res.json(flag);
  });

  app.get("/api/admin/metrics", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      // Return computed live stats for charts (last 30 days, daily)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Daily jobs created (last 30 days)
      const dailyJobs = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day, count(*)::int as count
        FROM jobs WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY 1 ORDER BY 1
      `);

      // Daily revenue (last 30 days)
      const dailyRevenue = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day, sum(amount::numeric)::float as total
        FROM payments WHERE status = 'COMPLETED' AND created_at >= ${thirtyDaysAgo}
        GROUP BY 1 ORDER BY 1
      `);

      // Daily new users (last 30 days)
      const dailyUsers = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day, count(*)::int as count
        FROM users WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY 1 ORDER BY 1
      `);

      // Summary totals
      const [totalUsers] = await db.select({ c: count() }).from(users);
      const [totalJobs] = await db.select({ c: count() }).from(jobs);
      const [totalBookings] = await db.select({ c: count() }).from(bookings);
      const [totalRevenue] = await db.select({ s: sum(payments.amount) }).from(payments).where(eq(payments.status, "COMPLETED"));
      const [activeJobs] = await db.select({ c: count() }).from(jobs).where(or(eq(jobs.status, "LIVE"), eq(jobs.status, "BOOSTED"))!);
      const [totalUnlocks] = await db.select({ c: count() }).from(jobUnlocks);

      // Jobs by status breakdown
      const jobsByStatus = await db.select({ status: jobs.status, c: count() }).from(jobs).groupBy(jobs.status);

      // Platform metrics table rows (historical)
      const rawMetrics = await db.select().from(platformMetrics).orderBy(desc(platformMetrics.recordedAt)).limit(50);

      return res.json({
        dailyJobs: dailyJobs.rows,
        dailyRevenue: dailyRevenue.rows,
        dailyUsers: dailyUsers.rows,
        summary: {
          totalUsers: totalUsers.c,
          totalJobs: totalJobs.c,
          activeJobs: activeJobs.c,
          totalBookings: totalBookings.c,
          totalRevenue: totalRevenue.s || "0",
          totalUnlocks: totalUnlocks.c,
        },
        jobsByStatus,
        rawMetrics,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/payments", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { from, to, type } = req.query as any;
      let conditions: any[] = [];
      if (from) conditions.push(gte(payments.createdAt, new Date(from)));
      if (to) conditions.push(lte(payments.createdAt, new Date(to + 'T23:59:59Z')));
      if (type) conditions.push(eq(payments.paymentMethod, type));

      const result = await db.select({
        id: payments.id, userId: payments.userId, amount: payments.amount,
        currency: payments.currency, status: payments.status, paymentMethod: payments.paymentMethod,
        description: payments.description, stripePaymentId: payments.stripePaymentId,
        createdAt: payments.createdAt,
        userName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${payments.userId})`,
        userEmail: sql<string>`(select email from users where id = ${payments.userId})`,
      }).from(payments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(payments.createdAt))
        .limit(500);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVENIENCE ALIASES (frontend compatibility)
  // ═══════════════════════════════════════════════════════════════════════════

  // /api/conversations → /api/chat/conversations alias
  app.get("/api/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const rows = await db
      .select()
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
      .where(eq(conversationParticipants.userId, userId))
      .orderBy(desc(conversations.lastMessageAt));
    return res.json(rows.map((r: any) => r.conversations));
  });

  // POST /api/conversations — find or create a DIRECT conversation
  // Used by booking chat buttons: finds conversation by jobId (preferred) or by participant pair
  app.post("/api/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { participantId, jobId } = req.body;
      if (!participantId) return res.status(400).json({ error: "participantId required" });

      // 1. If jobId provided, find the conversation for this job (most accurate)
      if (jobId) {
        const myJobConvs = await db
          .select({ conv: conversations })
          .from(conversations)
          .innerJoin(conversationParticipants, eq(conversationParticipants.conversationId, conversations.id))
          .where(and(eq(conversations.jobId, jobId), eq(conversationParticipants.userId, userId)));
        if (myJobConvs.length > 0) {
          return res.json({ ...myJobConvs[0].conv });
        }
      }

      // 2. Find any existing DIRECT conversation between these two users
      const myConvIds = await db
        .select({ convId: conversationParticipants.conversationId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.userId, userId));

      if (myConvIds.length > 0) {
        const convIdList = myConvIds.map(r => r.convId);
        const sharedConvs = await db
          .select({ convId: conversationParticipants.conversationId })
          .from(conversationParticipants)
          .where(and(
            eq(conversationParticipants.userId, participantId),
            inArray(conversationParticipants.conversationId, convIdList)
          ));
        if (sharedConvs.length > 0) {
          // Return first shared conversation
          const [existingConv] = await db.select().from(conversations).where(eq(conversations.id, sharedConvs[0].convId));
          if (existingConv) return res.json(existingConv);
        }
      }

      // 3. Create a new DIRECT conversation
      const [newConv] = await db.insert(conversations).values({
        type: "DIRECT", status: "ACTIVE", createdBy: userId,
        jobId: jobId || null, lastMessageAt: new Date(),
      }).returning();
      await db.insert(conversationParticipants).values([
        { conversationId: newConv.id, userId, role: "MEMBER" },
        { conversationId: newConv.id, userId: participantId, role: "MEMBER" },
      ]);
      return res.json(newConv);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REVIEWS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/reviews", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.query;
      const proId = targetUserId ? String(targetUserId) : userId;
      const whereClause = and(eq(reviews.revieweeId, proId), eq(reviews.isVisible, true));

      // Join reviewer name and pro name for context-rich display
      const rows = await db.select({
        id: reviews.id,
        bookingId: reviews.bookingId,
        reviewerId: reviews.reviewerId,
        revieweeId: reviews.revieweeId,
        rating: reviews.rating,
        title: reviews.title,
        comment: reviews.comment,
        proReply: (reviews as any).proReply,
        proRepliedAt: (reviews as any).proRepliedAt,
        isVisible: reviews.isVisible,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(whereClause)
      .orderBy(desc(reviews.createdAt));

      // Attach reviewer names separately to avoid complex join type issues
      const enriched = await Promise.all(rows.map(async (r) => {
        const [reviewer] = await db.select({
          firstName: users.firstName, lastName: users.lastName, avatarUrl: users.avatarUrl
        }).from(users).where(eq(users.id, r.reviewerId));
        const [reviewee] = await db.select({
          firstName: users.firstName, lastName: users.lastName
        }).from(users).where(eq(users.id, r.revieweeId));
        return {
          ...r,
          reviewerFirstName: reviewer?.firstName,
          reviewerLastName: reviewer?.lastName,
          reviewerAvatarUrl: reviewer?.avatarUrl,
          revieweeFirstName: reviewee?.firstName,
          revieweeLastName: reviewee?.lastName,
          proName: reviewee ? `${reviewee.firstName} ${reviewee.lastName}` : undefined,
        };
      }));

      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reviews/given", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const rows = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.reviewerId, userId), eq(reviews.isVisible, true)))
        .orderBy(desc(reviews.createdAt));
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Pro reply to a review ───────────────────────────────────────────────
  app.post("/api/reviews/:id/reply", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
    try {
      const { reply } = req.body;
      if (!reply || reply.trim().length === 0) {
        return res.status(400).json({ error: "Reply text is required" });
      }
      if (reply.trim().length > 1000) {
        return res.status(400).json({ error: "Reply must be 1000 characters or fewer" });
      }

      const [review] = await db.select().from(reviews).where(eq(reviews.id, req.params.id as string));
      if (!review || !review.isVisible) return res.status(404).json({ error: "Review not found" });

      // Review must belong to this professional's profile
      if (review.revieweeId !== req.user!.userId) {
        return res.status(403).json({ error: "You can only reply to reviews on your own profile" });
      }

      // One reply only — immutable after submission
      if ((review as any).proReply) {
        return res.status(409).json({ error: "You have already replied to this review. Replies cannot be changed." });
      }

      // Moderate reply text
      const replyMod = moderateText(reply, { fieldName: "reply" });
      if (replyMod.blocked) {
        return res.status(422).json({ error: replyMod.userMessage });
      }

      const [updated] = await db.update(reviews)
        .set({ proReply: reply.trim(), proRepliedAt: new Date() } as any)
        .where(eq(reviews.id, routeParam(req.params.id)))
        .returning();

      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRO ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════

  // Unified pro onboarding: register + create profile in one shot
  app.post("/api/onboarding/professional", async (req: Request, res: Response) => {
    return res.status(410).json({
      error: "Professional onboarding now runs through the role-aware onboarding flow at /register.",
    });

    try {
      const {
        email, password, firstName, lastName, phone,
        bio, specialisations, yearsExperience, serviceRadius,
        categoryIds, location
      } = req.body;
      if (!email || !password || !firstName || !lastName || !phone) {
        return res.status(400).json({ error: "Missing required fields (email, password, name, and phone are mandatory)" });
      }
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

      const passwordHash = await hashPassword(password);

      const result = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          phone,
          bio: bio || "",
          role: "PROFESSIONAL",
          status: "ACTIVE",
          emailVerified: false,
          phoneVerified: false,
          onboardingCompleted: true,
          creditBalance: 20
        }).returning();

        const [profile] = await tx.insert(professionalProfiles).values({
          userId: user.id,
          yearsExperience: yearsExperience || 0,
          radiusKm: serviceRadius || 25,
          serviceCategories: categoryIds || [],
          isVerified: false,
          ratingAvg: "0",
          totalReviews: 0
        }).returning();

        // Add starter credit transaction
        await tx.insert(creditTransactions).values({
          userId: user.id, type: "BONUS", amount: 20, balanceAfter: 20,
          description: "Starter bonus — welcome to ServiceConnect!"
        });

        return { user, profile };
      });

      const { accessToken, refreshToken } = generateTokens(result.user.id, result.user.role);
      await db.insert(userSessions).values({
        userId: result.user.id, refreshTokenHash: await hashPassword(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      return res.status(201).json({
        user: {
          id: result.user.id, email: result.user.email,
          firstName: result.user.firstName, lastName: result.user.lastName,
          role: result.user.role, creditBalance: result.user.creditBalance
        },
        accessToken, refreshToken,
        profile: result.profile
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER PROFILE UPDATE (settings)
  // ═══════════════════════════════════════════════════════════════════════════

  app.patch("/api/auth/profile", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const { firstName, lastName, phone, avatarUrl } = req.body;

      // Customers cannot change their name after initial setup — admin override only
      if (userRole === "CUSTOMER" && (firstName !== undefined || lastName !== undefined)) {
        return res.status(403).json({
          error: "Your name cannot be changed. If you need a correction, please contact support."
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (userRole !== "CUSTOMER") {
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
      }
      if (phone !== undefined) updateData.phone = phone || null;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      // Sanitized response — no internal id or passwordHash for customers
      const isCustomer = updated.role === "CUSTOMER";
      return res.json({
        ...(isCustomer ? {} : { id: updated.id }),
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        role: updated.role,
        creditBalance: updated.creditBalance,
        avatarUrl: updated.avatarUrl,
        phoneVerified: (updated as any).phoneVerified ?? false,
        emailVerified: updated.emailVerified,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ─── Admin: correct customer/user name ───────────────────────────────────
  app.patch("/api/admin/users/:id/name", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { firstName, lastName, reason } = req.body;
      if (!firstName && !lastName) return res.status(400).json({ error: "Provide firstName or lastName to update" });

      // Fetch current user BEFORE update to capture previous values for audit
      const [existing] = await db.select().from(users).where(eq(users.id, req.params.id as string));
      if (!existing) return res.status(404).json({ error: "User not found" });

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;

      const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id as string)).returning();

      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId,
        action: "UPDATE_USER_NAME",
        resourceType: "USER",
        resourceId: req.params.id as string,
        changes: {
          previous: { firstName: existing.firstName, lastName: existing.lastName },
          new: { firstName: updated.firstName, lastName: updated.lastName },
          reason: reason || undefined,
        },
        ipAddress: req.ip,
      });

      return res.json({ success: true, firstName: updated.firstName, lastName: updated.lastName });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: SUSPEND / BAN USER
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/admin/users/:id/suspend", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      await db.update(users).set({ status: "SUSPENDED" }).where(eq(users.id, req.params.id as string));
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "SUSPEND_USER", resourceType: "USER",
        resourceId: req.params.id as string, changes: { reason }, ipAddress: req.ip
      });
      return res.json({ success: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  app.post("/api/admin/users/:id/unsuspend", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, req.params.id as string));
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "UNSUSPEND_USER", resourceType: "USER",
        resourceId: req.params.id as string, changes: {}, ipAddress: req.ip
      });
      return res.json({ success: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // Admin quick-reply (convenience alias — uses the main /messages endpoint logic)
  app.post("/api/support/tickets/:id/reply", requireAuth, requireRole("ADMIN", "SUPPORT"), async (req: AuthRequest, res: Response) => {
    try {
      const { content, message: msgText, isInternal } = req.body;
      const text = (content || msgText || "").trim();
      if (!text) return res.status(400).json({ error: "Reply content is required" });
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, req.params.id as string));
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      const [msg] = await db.insert(ticketMessages).values({
        ticketId: req.params.id as string, senderId: req.user!.userId,
        message: text, isInternal: isInternal ? true : false
      }).returning();
      const updateFields: any = { updatedAt: new Date() };
      if (!ticket.firstResponseAt) updateFields.firstResponseAt = new Date();
      if (ticket.status === "OPEN") updateFields.status = "IN_PROGRESS";
      await db.update(supportTickets).set(updateFields).where(eq(supportTickets.id, req.params.id as string));
      if (!isInternal) {
        await createNotification(ticket.userId, "TICKET_REPLY", "Support reply",
          `New reply on: ${ticket.subject}`, { ticketId: ticket.id });
      }
      return res.json(msg);
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // Get ticket messages (enriched with sender info)
  app.get("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const rawMsgs = await db.select().from(ticketMessages)
        .where(eq(ticketMessages.ticketId, req.params.id as string))
        .orderBy(asc(ticketMessages.createdAt));
      const [viewer] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user!.userId));
      const isStaff = viewer?.role === "ADMIN" || viewer?.role === "SUPPORT";
      const msgs = await Promise.all(rawMsgs.map(async (m) => {
        const [sender] = await db.select({ firstName: users.firstName, lastName: users.lastName, role: users.role })
          .from(users).where(eq(users.id, m.senderId));
        return { ...m, senderName: sender ? `${sender.firstName} ${sender.lastName}` : "System",
          senderRole: sender?.role, isStaff: sender?.role === "ADMIN" || sender?.role === "SUPPORT" };
      }));
      // Filter internal notes from non-staff
      const filtered = isStaff ? msgs : msgs.filter(m => !m.isInternal);
      return res.json(filtered);
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERCEL CRON ENDPOINT — called hourly by Vercel Cron in production
  // This replaces the node-cron scheduler which cannot run in serverless
  // ═══════════════════════════════════════════════════════════════════════════
  app.get("/api/cron/aftercare", async (req: Request, res: Response) => {
    // Verify secret to prevent unauthorized manual triggers
    const secret = req.headers["x-cron-secret"] || req.query.secret;
    if (process.env.NODE_ENV === "production" && secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      await runAftercareCheck(createNotification);
      return res.json({ success: true, ran: new Date().toISOString() });
    } catch (err: any) {
      console.error("[Cron] Aftercare check failed:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Admin: stats endpoint  
  app.get("/api/admin/stats", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [totalJobs] = await db.select({ count: count() }).from(jobs);
      const [totalBookings] = await db.select({ count: count() }).from(bookings);
      const [totalRevenue] = await db.select({ total: sum(payments.amount) }).from(payments)
        .where(eq(payments.status, "COMPLETED"));
      return res.json({
        totalUsers: totalUsers.count,
        totalJobs: totalJobs.count,
        totalBookings: totalBookings.count,
        totalRevenue: totalRevenue.total || "0"
      });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: QUOTES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/quotes", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as any;
      const { limit, offset } = safePagination(req.query as any);
      let conditions: any[] = [];
      if (status) conditions.push(eq(quotes.status, status));

      const result = await db.select({
        id: quotes.id, jobId: quotes.jobId, professionalId: quotes.professionalId,
        customerId: quotes.customerId, amount: quotes.amount, message: quotes.message,
        estimatedDuration: quotes.estimatedDuration, status: quotes.status,
        validUntil: quotes.validUntil, createdAt: quotes.createdAt, updatedAt: quotes.updatedAt,
        jobTitle: sql<string>`(select title from jobs where id = ${quotes.jobId})`,
        proName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${quotes.professionalId})`,
        customerName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${quotes.customerId})`,
      }).from(quotes)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(quotes.createdAt)).limit(limit).offset(offset);

      const [{ c }] = await db.select({ c: count() }).from(quotes)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Funnel stats
      const [totalQuotes] = await db.select({ c: count() }).from(quotes);
      const [pendingQuotes] = await db.select({ c: count() }).from(quotes).where(eq(quotes.status, "PENDING"));
      const [acceptedQuotes] = await db.select({ c: count() }).from(quotes).where(eq(quotes.status, "ACCEPTED"));
      const [rejectedQuotes] = await db.select({ c: count() }).from(quotes).where(eq(quotes.status, "REJECTED"));
      const [avgAmount] = await db.select({ a: avg(quotes.amount) }).from(quotes);

      return res.json({
        quotes: result, total: c,
        funnel: {
          total: totalQuotes.c, pending: pendingQuotes.c,
          accepted: acceptedQuotes.c, rejected: rejectedQuotes.c,
          avgAmount: avgAmount.a || "0",
          conversionRate: totalQuotes.c > 0 ? ((acceptedQuotes.c / totalQuotes.c) * 100).toFixed(1) : "0"
        }
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/quotes/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      const quoteId = routeParam(req.params.id);
      const [updated] = await db.update(quotes).set({ status, updatedAt: new Date() })
        .where(eq(quotes.id, quoteId)).returning();
      if (!updated) return res.status(404).json({ error: "Quote not found" });
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "UPDATE_QUOTE_STATUS", resourceType: "QUOTE",
        resourceId: quoteId, changes: { status }, ipAddress: req.ip
      });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: BOOKINGS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/bookings", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query as any;
      const { limit, offset } = safePagination(req.query as any);
      let conditions: any[] = [];
      if (status) conditions.push(eq(bookings.status, status));

      const result = await db.select({
        id: bookings.id, quoteId: bookings.quoteId, jobId: bookings.jobId,
        customerId: bookings.customerId, professionalId: bookings.professionalId,
        serviceDate: bookings.serviceDate, serviceTime: bookings.serviceTime,
        durationHours: bookings.durationHours, totalAmount: bookings.totalAmount,
        status: bookings.status, cancellationReason: bookings.cancellationReason,
        completedAt: bookings.completedAt, createdAt: bookings.createdAt, updatedAt: bookings.updatedAt,
        jobTitle: sql<string>`(select title from jobs where id = ${bookings.jobId})`,
        proName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${bookings.professionalId})`,
        customerName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${bookings.customerId})`,
      }).from(bookings)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bookings.createdAt)).limit(limit).offset(offset);

      const [{ c }] = await db.select({ c: count() }).from(bookings)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Funnel stats
      const [totalBookings] = await db.select({ c: count() }).from(bookings);
      const [confirmed] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "CONFIRMED"));
      const [inProgress] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "IN_PROGRESS"));
      const [completed] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "COMPLETED"));
      const [cancelled] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "CANCELLED"));
      const [disputed] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "DISPUTED"));
      const [totalValue] = await db.select({ s: sum(bookings.totalAmount) }).from(bookings).where(eq(bookings.status, "COMPLETED"));

      return res.json({
        bookings: result, total: c,
        funnel: {
          total: totalBookings.c, confirmed: confirmed.c, inProgress: inProgress.c,
          completed: completed.c, cancelled: cancelled.c, disputed: disputed.c,
          completionRate: totalBookings.c > 0 ? ((completed.c / totalBookings.c) * 100).toFixed(1) : "0",
          totalCompletedValue: totalValue.s || "0"
        }
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/bookings/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, cancellationReason } = req.body;
      const bookingId = routeParam(req.params.id);
      const updateData: any = { status, updatedAt: new Date() };
      if (cancellationReason) updateData.cancellationReason = cancellationReason;
      if (status === "COMPLETED") updateData.completedAt = new Date();
      const [updated] = await db.update(bookings).set(updateData).where(eq(bookings.id, bookingId)).returning();
      if (!updated) return res.status(404).json({ error: "Booking not found" });
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "UPDATE_BOOKING_STATUS", resourceType: "BOOKING",
        resourceId: bookingId, changes: { status, cancellationReason }, ipAddress: req.ip
      });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: REVIEWS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/reviews", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { visible } = req.query as any;
      const { limit, offset } = safePagination(req.query as any);
      let conditions: any[] = [];
      if (visible === "true") conditions.push(eq(reviews.isVisible, true));
      if (visible === "false") conditions.push(eq(reviews.isVisible, false));

      const result = await db.select({
        id: reviews.id, bookingId: reviews.bookingId, reviewerId: reviews.reviewerId,
        revieweeId: reviews.revieweeId, rating: reviews.rating, title: reviews.title,
        comment: reviews.comment, response: reviews.response, proReply: reviews.proReply,
        isVisible: reviews.isVisible, createdAt: reviews.createdAt,
        reviewerName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${reviews.reviewerId})`,
        revieweeName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${reviews.revieweeId})`,
      }).from(reviews)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(reviews.createdAt)).limit(limit).offset(offset);

      const [{ c }] = await db.select({ c: count() }).from(reviews)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const [avgRating] = await db.select({ a: avg(reviews.rating) }).from(reviews).where(eq(reviews.isVisible, true));
      const [totalReviews] = await db.select({ c: count() }).from(reviews);

      // Rating distribution
      const distribution = await db.select({ rating: reviews.rating, c: count() })
        .from(reviews).where(eq(reviews.isVisible, true)).groupBy(reviews.rating);

      return res.json({
        reviews: result, total: c,
        stats: {
          avgRating: avgRating.a ? parseFloat(String(avgRating.a)).toFixed(1) : "0",
          totalReviews: totalReviews.c,
          distribution: distribution.reduce((acc: any, d: any) => { acc[d.rating] = d.c; return acc; }, {})
        }
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/reviews/:id/visibility", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { isVisible, reason } = req.body;
      const reviewId = routeParam(req.params.id);
      const [updated] = await db.update(reviews).set({ isVisible })
        .where(eq(reviews.id, reviewId)).returning();
      if (!updated) return res.status(404).json({ error: "Review not found" });
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: isVisible ? "SHOW_REVIEW" : "HIDE_REVIEW",
        resourceType: "REVIEW", resourceId: reviewId, changes: { isVisible, reason }, ipAddress: req.ip
      });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: USER DETAIL (activity, jobs, quotes, bookings, reviews)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/users/:id/detail", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const userId = routeParam(req.params.id);
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: "User not found" });

      // Professional profile if applicable
      let profile = null;
      if (user.role === "PROFESSIONAL") {
        const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId));
        profile = p || null;
      }

      // Jobs (as customer)
      const userJobs = await db.select({ id: jobs.id, title: jobs.title, status: jobs.status, createdAt: jobs.createdAt })
        .from(jobs).where(eq(jobs.customerId, userId)).orderBy(desc(jobs.createdAt)).limit(20);

      // Quotes (as pro or customer)
      const userQuotes = await db.select({
        id: quotes.id, jobId: quotes.jobId, amount: quotes.amount, status: quotes.status, createdAt: quotes.createdAt,
        jobTitle: sql<string>`(select title from jobs where id = ${quotes.jobId})`,
      }).from(quotes)
        .where(or(eq(quotes.professionalId, userId), eq(quotes.customerId, userId))!)
        .orderBy(desc(quotes.createdAt)).limit(20);

      // Bookings
      const userBookings = await db.select({
        id: bookings.id, jobId: bookings.jobId, totalAmount: bookings.totalAmount, status: bookings.status,
        serviceDate: bookings.serviceDate, createdAt: bookings.createdAt,
        jobTitle: sql<string>`(select title from jobs where id = ${bookings.jobId})`,
      }).from(bookings)
        .where(or(eq(bookings.professionalId, userId), eq(bookings.customerId, userId))!)
        .orderBy(desc(bookings.createdAt)).limit(20);

      // Reviews (given and received)
      const reviewsGiven = await db.select({
        id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt,
        revieweeName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${reviews.revieweeId})`,
      }).from(reviews).where(eq(reviews.reviewerId, userId)).orderBy(desc(reviews.createdAt)).limit(10);

      const reviewsReceived = await db.select({
        id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt,
        reviewerName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${reviews.reviewerId})`,
      }).from(reviews).where(eq(reviews.revieweeId, userId)).orderBy(desc(reviews.createdAt)).limit(10);

      // Credit transactions
      const creditTx = await db.select().from(creditTransactions)
        .where(eq(creditTransactions.userId, userId))
        .orderBy(desc(creditTransactions.createdAt)).limit(20);

      // Audit trail for this user
      const auditTrail = await db.select().from(adminAuditLogs)
        .where(eq(adminAuditLogs.resourceId, userId))
        .orderBy(desc(adminAuditLogs.createdAt)).limit(20);

      return res.json({
        user: { ...user, passwordHash: undefined },
        profile,
        jobs: userJobs,
        quotes: userQuotes,
        bookings: userBookings,
        reviewsGiven,
        reviewsReceived,
        creditTransactions: creditTx,
        auditTrail,
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: JOB DETAIL (unlocks, quotes, bookings, timeline)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/jobs/:id/detail", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const jobId = routeParam(req.params.id);
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) return res.status(404).json({ error: "Job not found" });

      const [customer] = await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users).where(eq(users.id, job.customerId));

      const [category] = await db.select({ name: serviceCategories.name, slug: serviceCategories.slug })
        .from(serviceCategories).where(eq(serviceCategories.id, job.categoryId));

      const unlocks = await db.select({
        id: jobUnlocks.id, professionalId: jobUnlocks.professionalId, tier: jobUnlocks.tier,
        creditsSpent: jobUnlocks.creditsSpent, unlockedAt: jobUnlocks.unlockedAt,
        proName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${jobUnlocks.professionalId})`,
      }).from(jobUnlocks).where(eq(jobUnlocks.jobId, jobId)).orderBy(desc(jobUnlocks.unlockedAt));

      const jobQuotes = await db.select({
        id: quotes.id, professionalId: quotes.professionalId, amount: quotes.amount,
        status: quotes.status, createdAt: quotes.createdAt,
        proName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${quotes.professionalId})`,
      }).from(quotes).where(eq(quotes.jobId, jobId)).orderBy(desc(quotes.createdAt));

      const jobBookings = await db.select({
        id: bookings.id, professionalId: bookings.professionalId, totalAmount: bookings.totalAmount,
        status: bookings.status, serviceDate: bookings.serviceDate, completedAt: bookings.completedAt,
        proName: sql<string>`(select concat(first_name, ' ', last_name) from users where id = ${bookings.professionalId})`,
      }).from(bookings).where(eq(bookings.jobId, jobId)).orderBy(desc(bookings.createdAt));

      const boosts = await db.select().from(jobBoosts).where(eq(jobBoosts.jobId, jobId));
      const aftercare = await db.select().from(jobAftercares).where(eq(jobAftercares.jobId, jobId));

      return res.json({
        job, customer, category,
        unlocks, quotes: jobQuotes, bookings: jobBookings,
        boosts, aftercare,
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: CATEGORIES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/categories", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const cats = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder));
      // Count jobs per category
      const withCounts = await Promise.all(cats.map(async (cat) => {
        const [{ c }] = await db.select({ c: count() }).from(jobs).where(eq(jobs.categoryId, cat.id));
        return { ...cat, jobCount: c };
      }));
      return res.json(withCounts);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/admin/categories/:id", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, isActive, sortOrder, baseCreditCost, icon } = req.body;
      const catId = routeParam(req.params.id);
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (baseCreditCost !== undefined) updateData.baseCreditCost = baseCreditCost;
      if (icon !== undefined) updateData.icon = icon;
      const [updated] = await db.update(serviceCategories).set(updateData)
        .where(eq(serviceCategories.id, catId)).returning();
      if (!updated) return res.status(404).json({ error: "Category not found" });
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "UPDATE_CATEGORY", resourceType: "CATEGORY",
        resourceId: catId, changes: updateData, ipAddress: req.ip
      });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: ENHANCED DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/dashboard/enhanced", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Core counts
      const [totalUsers] = await db.select({ c: count() }).from(users).where(isNull(users.deletedAt));
      const [totalJobs] = await db.select({ c: count() }).from(jobs);
      const [activeJobs] = await db.select({ c: count() }).from(jobs).where(or(eq(jobs.status, "LIVE"), eq(jobs.status, "BOOSTED"))!);
      const [totalBookings] = await db.select({ c: count() }).from(bookings);
      const [completedBookings] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "COMPLETED"));
      const [totalRevenue] = await db.select({ s: sum(payments.amount) }).from(payments).where(eq(payments.status, "COMPLETED"));
      const [totalQuotes] = await db.select({ c: count() }).from(quotes);
      const [acceptedQuotes] = await db.select({ c: count() }).from(quotes).where(eq(quotes.status, "ACCEPTED"));
      const [totalUnlocks] = await db.select({ c: count() }).from(jobUnlocks);
      const [totalReviews] = await db.select({ c: count() }).from(reviews).where(eq(reviews.isVisible, true));
      const [avgRating] = await db.select({ a: avg(reviews.rating) }).from(reviews).where(eq(reviews.isVisible, true));
      const [openTickets] = await db.select({ c: count() }).from(supportTickets).where(or(eq(supportTickets.status, "OPEN"), eq(supportTickets.status, "IN_PROGRESS"))!);
      const [disputedBookings] = await db.select({ c: count() }).from(bookings).where(eq(bookings.status, "DISPUTED"));
      const [flaggedMessages] = await db.select({ c: count() }).from(messages).where(and(eq(messages.isFiltered, true), isNull(messages.deletedAt)));
      const [pendingVerifications] = await db.select({ c: count() }).from(professionalProfiles).where(eq(professionalProfiles.verificationStatus, "PENDING"));

      // 7-day trends
      const [recentUsers] = await db.select({ c: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo));
      const [recentJobs] = await db.select({ c: count() }).from(jobs).where(gte(jobs.createdAt, sevenDaysAgo));
      const [recentBookings] = await db.select({ c: count() }).from(bookings).where(gte(bookings.createdAt, sevenDaysAgo));

      // Users by role
      const usersByRole = await db.select({ role: users.role, c: count() }).from(users).where(isNull(users.deletedAt)).groupBy(users.role);
      // Jobs by status
      const jobsByStatus = await db.select({ status: jobs.status, c: count() }).from(jobs).groupBy(jobs.status);
      // Bookings by status
      const bookingsByStatus = await db.select({ status: bookings.status, c: count() }).from(bookings).groupBy(bookings.status);

      // Marketplace health: conversion funnel
      const quoteConversion = totalQuotes.c > 0 ? ((acceptedQuotes.c / totalQuotes.c) * 100).toFixed(1) : "0";
      const bookingCompletion = totalBookings.c > 0 ? ((completedBookings.c / totalBookings.c) * 100).toFixed(1) : "0";

      return res.json({
        kpis: {
          totalUsers: totalUsers.c, totalJobs: totalJobs.c, activeJobs: activeJobs.c,
          totalBookings: totalBookings.c, completedBookings: completedBookings.c,
          totalRevenue: totalRevenue.s || "0",
          totalQuotes: totalQuotes.c, acceptedQuotes: acceptedQuotes.c,
          totalUnlocks: totalUnlocks.c, totalReviews: totalReviews.c,
          avgRating: avgRating.a ? parseFloat(String(avgRating.a)).toFixed(1) : "0",
          openTickets: openTickets.c, disputedBookings: disputedBookings.c,
          flaggedMessages: flaggedMessages.c, pendingVerifications: pendingVerifications.c,
        },
        trends: { recentUsers: recentUsers.c, recentJobs: recentJobs.c, recentBookings: recentBookings.c },
        health: { quoteConversion, bookingCompletion },
        breakdowns: { usersByRole, jobsByStatus, bookingsByStatus },
      });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN: ADMIN JOB STATUS UPDATE
  // ═══════════════════════════════════════════════════════════════════════════

  app.patch("/api/admin/jobs/:id/status", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, reason } = req.body;
      const jobId = routeParam(req.params.id);
      const [updated] = await db.update(jobs).set({ status, updatedAt: new Date() })
        .where(eq(jobs.id, jobId)).returning();
      if (!updated) return res.status(404).json({ error: "Job not found" });
      await db.insert(adminAuditLogs).values({
        adminId: req.user!.userId, action: "UPDATE_JOB_STATUS", resourceType: "JOB",
        resourceId: jobId, changes: { status, reason }, ipAddress: req.ip
      });
      return res.json(updated);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI-POWERED ENDPOINTS (Gemini)
  // ═══════════════════════════════════════════════════════════════════════════

  // Health check
  app.get("/api/ai/status", (req, res) => {
    res.json({ available: isGeminiAvailable(), model: "gemini-2.0-flash" });
  });

  // AI: Enhance job description
  app.post("/api/ai/enhance-description", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, category } = req.body;
      if (!title || !description) return res.status(400).json({ error: "title and description required" });
      const result = await enhanceJobDescription(title, description, category || "general");
      return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Smart category detection
  app.post("/api/ai/detect-category", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, description } = req.body;
      if (!title || !description) return res.status(400).json({ error: "title and description required" });
      const allCats = await db.select({ slug: serviceCategories.slug, name: serviceCategories.name }).from(serviceCategories);
      const result = await smartCategoryDetect(title, description, allCats);
      return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Quote suggestion for pros
  app.post("/api/ai/suggest-quote", requireAuth, requireRole("PROFESSIONAL", "ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { jobId } = req.body;
      if (!jobId) return res.status(400).json({ error: "jobId required" });

      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) return res.status(404).json({ error: "Job not found" });

      const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, job.categoryId));
      const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, req.user!.userId));
      const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));

      const result = await generateQuoteSuggestion(
        job.title, job.description, cat?.name || "service",
        `${user?.firstName || ""} ${user?.lastName || ""}`.trim(),
        (profile?.serviceCategories as string[]) || []
      );
      return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Chat assistant
  // Sandboxed AI widget — only two permitted actions: post_job guidance and support ticket creation
  app.post("/api/ai/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, mode } = req.body;
      if (!message) return res.status(400).json({ error: "message required" });

      const userId = req.user!.userId;
      const userRole = req.user!.role as "CUSTOMER" | "PROFESSIONAL" | "ADMIN";

      // Fetch only the user's own name — nothing else is passed to AI
      const [user] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, userId));
      const userName = user ? `${user.firstName} ${user.lastName}` : "User";

      // Pass sandboxed context to restrict AI scope
      const sandboxedContext = { userName, userRole };
      const result = await aiChatAssistant(message, userRole, history || [], sandboxedContext);

      // Support ticket creation — only permitted data action
      if (result.action === "create_ticket" && result.ticketData) {
        const td = result.ticketData;
        const [ticket] = await db.insert(supportTickets).values({
          userId,
          subject: td.subject,
          description: td.description,
          category: td.category,
          priority: td.priority || "MEDIUM",
          status: "OPEN",
        }).returning();

        return res.json({
          reply: result.reply,
          ticketCreated: true,
          ticketId: ticket.id,
          ticketSubject: td.subject,
        });
      }

      return res.json({ reply: result.reply });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Create job draft from floating widget conversation
  app.post("/api/ai/create-draft", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { title, description, categorySlug, locationText, locationTown, locationEircode, urgency, budgetMin, budgetMax } = req.body;
      if (!title || !description) return res.status(400).json({ error: "title and description required" });

      // Find category by slug or use first match
      let categoryId: string | null = null;
      if (categorySlug) {
        const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.slug, categorySlug));
        categoryId = cat?.id || null;
      }
      if (!categoryId) {
        // AI auto-detect category
        const allCats = await db.select().from(serviceCategories);
        const catResult = detectCategory(title, description, allCats);
        const matchedCat = allCats.find(c => c.slug === catResult.categorySlug);
        categoryId = matchedCat?.id || allCats[0]?.id || null;
      }
      if (!categoryId) return res.status(400).json({ error: "No categories available" });

      const [cat] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, categoryId));
      const creditCost = cat?.baseCreditCost || 2;

      const refCode = "SC-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      const [job] = await db.insert(jobs).values({
        customerId: userId, categoryId, title, description,
        referenceCode: refCode,
        budgetMin: budgetMin ? String(budgetMin) : null,
        budgetMax: budgetMax ? String(budgetMax) : null,
        urgency: urgency || "NORMAL",
        status: "DRAFT",
        creditCost, originalCreditCost: creditCost,
        locationText: locationText || null,
        locationTown: locationTown || null,
        locationEircode: locationEircode || null,
      }).returning();

      return res.status(201).json(job);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Enhance pro bio
  app.post("/api/ai/enhance-bio", requireAuth, requireRole("PROFESSIONAL", "ADMIN"), async (req: AuthRequest, res: Response) => {
    try {
      const { bio, skills } = req.body;
      if (!bio) return res.status(400).json({ error: "bio required" });
      const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
      const result = await enhanceProBio(bio, skills || [], `${user?.firstName || ""} ${user?.lastName || ""}`.trim());
      return res.json(result);
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  // AI: Review summary for a pro
  app.get("/api/ai/review-summary/:proId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const proId = routeParam(req.params.proId);
      const proReviews = await db.select({
        rating: reviews.rating,
        comment: reviews.comment,
      }).from(reviews).where(eq(reviews.revieweeId, proId)).orderBy(desc(reviews.createdAt)).limit(10);

      if (proReviews.length === 0) return res.json({ summary: "" });

      const [proUser] = await db.select().from(users).where(eq(users.id, proId));
      const proName = `${proUser?.firstName || ""} ${proUser?.lastName || ""}`.trim();

      const reviewsForAI = proReviews.map(r => ({
        rating: r.rating,
        comment: r.comment || "",
        customerName: "Customer"
      }));

      const summary = await generateReviewSummary(proName, reviewsForAI);
      return res.json({ summary, reviewCount: proReviews.length });
    } catch (e: any) { return res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
