# ServiceConnect Platform Refinements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 8 production refinements covering verification gating, profile hardening, contact moderation, review ownership, AI branding, GDPR-friendly professional verification, marketplace openness, and AI widget sandboxing.

**Architecture:** Schema migrations via Drizzle push; new `server/moderationService.ts` as unified moderation layer; backend route guards for name immutability and ID stripping; frontend component refactors for widget scope restriction, name read-only, and review reply UI.

**Tech Stack:** TypeScript, Express, Drizzle ORM (PostgreSQL), React 18, Wouter, TanStack Query, Zod, Radix UI, Tailwind CSS, Google Gemini API

---

## File Map

| File | Change Type | Purpose |
|---|---|---|
| `shared/schema.ts` | Modify | Add `phoneVerified`, `phone_verification_tokens` table, `proReply`/`proRepliedAt` on reviews, `verificationLevel` on professional_profiles |
| `server/moderationService.ts` | Create | Unified moderation: profanity + phone blocking, context-aware |
| `server/routes.ts` | Modify | New OTP endpoints, review reply, admin name endpoint, profile guard, moderation wiring |
| `client/src/lib/constants.ts` | Create | `AI_DISPLAY_NAME` constant |
| `client/src/components/ai/AiAssistantWidget.tsx` | Rewrite | Two-action mode (post job / support ticket), remove Gemini branding |
| `client/src/components/auth/PhoneVerificationModal.tsx` | Create | Inline phone OTP modal for existing verified users |
| `client/src/pages/customer/PostJob.tsx` | Modify | Phone OTP step for new users, phone verification gate for logged-in users |
| `client/src/pages/customer/Settings.tsx` | Modify | Name fields read-only for customers |
| `client/src/pages/pro/ProfileEditor.tsx` | Modify | Review reply UI, optional verification copy |
| `client/src/pages/pro/VerificationPending.tsx` | Modify | Make optional, update copy |

---

## Task 1: Schema — Add phoneVerified + phone_verification_tokens

**Files:**
- Modify: `shared/schema.ts`

- [ ] **Step 1.1: Add `phoneVerified` to users table and new `phone_verification_tokens` table**

In `shared/schema.ts`, add `phoneVerified` to the `users` table after `emailVerified`:

```typescript
emailVerified: boolean("email_verified").notNull().default(false),
phoneVerified: boolean("phone_verified").notNull().default(false),
```

Then add the new table after `userSessions`:

```typescript
export const phoneVerificationTokens = pgTable("phone_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  hashedCode: text("hashed_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("phone_tokens_user_idx").on(t.userId)]);
```

- [ ] **Step 1.2: Add `proReply` and `proRepliedAt` to reviews table**

In `shared/schema.ts`, find the `reviews` table definition and add after `response` and `responseAt`:

```typescript
proReply: text("pro_reply"),
proRepliedAt: timestamp("pro_replied_at"),
```

- [ ] **Step 1.3: Add `verificationLevel` enum and field to professional_profiles**

After the existing enums block, add:

```typescript
export const verificationLevelEnum = pgEnum("verification_level", ["NONE", "SELF_DECLARED", "DOCUMENT_VERIFIED"]);
```

In `professionalProfiles` table, add after `isVerified`:

```typescript
verificationLevel: verificationLevelEnum("verification_level").notNull().default("NONE"),
```

- [ ] **Step 1.4: Export new types**

At the bottom of `shared/schema.ts` where other types are exported, add:

```typescript
export type PhoneVerificationToken = typeof phoneVerificationTokens.$inferSelect;
export type InsertPhoneVerificationToken = typeof phoneVerificationTokens.$inferInsert;
```

- [ ] **Step 1.5: Push schema to database**

```bash
cd C:/Users/balaj/Downloads/ServiceConnect_EVERYTHING/codebase_full
npm run db:push
```

Expected: Drizzle applies the new columns and table without errors.

- [ ] **Step 1.6: Update routes.ts import to include new tables**

In `server/routes.ts` at the top import from `@shared/schema`, add `phoneVerificationTokens` to the destructured imports.

---

## Task 2: Backend — Unified Moderation Service

**Files:**
- Create: `server/moderationService.ts`

- [ ] **Step 2.1: Create `server/moderationService.ts`**

```typescript
import { processMessageContent } from "./profanityFilter";

export interface ModerationOptions {
  /** When true, phone numbers are allowed (STANDARD tier unlock context) */
  allowPhone?: boolean;
  /** Field name for error messages */
  fieldName?: string;
}

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
  userMessage?: string;
  cleanedText: string;
  flags: string[];
  severity?: string;
}

// Extended phone patterns beyond what profanityFilter.ts covers
const EXTENDED_PHONE_PATTERNS = [
  // Spaced digits: "0 8 7 1 2 3 4 5 6" (7+ single digits separated by spaces)
  /\b(\d\s){6,}\d\b/g,
  // Written number words in sequence (6+ consecutive)
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought)(\s+(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought)){5,}\b/gi,
  // Mixed text-number: "087-one-two-three" or "oh eight seven"
  /\b(oh|zero|0)\s*(eight|ate|8)\s*(seven|7)\b/gi,
  // Separator bypass: dots, slashes between digit groups
  /\b0\d{2}[\.\/\\]\d{3}[\.\/\\]\d{4}\b/g,
  // Partial obfuscation with asterisks still revealing structure: "087 123 ****"
  /\b0\d{2}\s+\d{3}\s+[\d\*]{4}\b/g,
];

function hasExtendedPhonePattern(text: string): boolean {
  return EXTENDED_PHONE_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Moderates a text field. Returns blocked=true if the text should be rejected.
 * When allowPhone=true (STANDARD tier unlock context), phone numbers are permitted.
 */
export function moderateText(text: string, options: ModerationOptions = {}): ModerationResult {
  const { allowPhone = false, fieldName = "content" } = options;

  if (!text || text.trim().length === 0) {
    return { blocked: false, cleanedText: text, flags: [] };
  }

  // Run through existing profanity + contact filter
  const processed = processMessageContent(text, { maskContactInfo: !allowPhone });

  // If allowPhone is false and contact flags found, block
  if (!allowPhone && processed.flags.some(f =>
    f.includes("PHONE") || f.includes("EMAIL") || f.includes("SOCIAL") || f.includes("SPOKEN")
  )) {
    return {
      blocked: true,
      reason: "contact_info_detected",
      userMessage: `Your ${fieldName} appears to contain contact information (phone number, email, or social handle). Please keep communication within the platform.`,
      cleanedText: processed.content,
      flags: processed.flags,
      severity: processed.severity,
    };
  }

  // Additional extended phone pattern check
  if (!allowPhone && hasExtendedPhonePattern(text)) {
    return {
      blocked: true,
      reason: "phone_pattern_detected",
      userMessage: `Your ${fieldName} appears to contain a phone number. Please keep contact sharing within the platform's secure system.`,
      cleanedText: text,
      flags: ["EXTENDED_PHONE"],
    };
  }

  // If severe/critical profanity, also block (not just flag)
  if (processed.severity === "CRITICAL" || processed.severity === "SEVERE") {
    return {
      blocked: true,
      reason: "profanity_detected",
      userMessage: `Your ${fieldName} contains inappropriate language and cannot be submitted.`,
      cleanedText: processed.content,
      flags: processed.flags,
      severity: processed.severity,
    };
  }

  return {
    blocked: false,
    cleanedText: processed.content,
    flags: processed.flags,
    severity: processed.severity,
  };
}
```

---

## Task 3: Backend — Phone OTP Endpoints

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 3.1: Add import for `phoneVerificationTokens` in routes.ts**

Find the schema import line in `server/routes.ts` (around line 7) and add `phoneVerificationTokens` to the import.

Also add `hashPassword` import is already present. Add `crypto` usage by adding at the top of the file (after existing imports):

```typescript
import { randomInt } from "crypto";
```

- [ ] **Step 3.2: Add `POST /api/auth/send-phone-otp` endpoint**

Find the `POST /api/auth/logout` handler (around line 254) and add AFTER it:

```typescript
// ── Phone OTP: Send ──────────────────────────────────────────────────────────
app.post("/api/auth/send-phone-otp", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.phoneVerified) return res.json({ success: true, alreadyVerified: true });
    if (!user.phone) return res.status(400).json({ error: "No phone number on file. Please add your phone number first." });

    // Generate 6-digit code
    const code = String(randomInt(100000, 999999));
    const hashedCode = await hashPassword(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old tokens
    await db.delete(phoneVerificationTokens).where(
      and(eq(phoneVerificationTokens.userId, userId), eq(phoneVerificationTokens.used, false))
    );

    await db.insert(phoneVerificationTokens).values({ userId, hashedCode, expiresAt });

    // In production: send SMS via provider. In dev: log code.
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Phone OTP for ${user.phone}: ${code}`);
    }
    // TODO: integrate SMS provider (Twilio) in production

    return res.json({ success: true, message: "Verification code sent to your phone." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Phone OTP: Verify ────────────────────────────────────────────────────────
app.post("/api/auth/verify-phone-otp", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Verification code required" });

    // In dev, accept "123456" as master code
    const isDev = process.env.NODE_ENV === "development";

    const [token] = await db.select().from(phoneVerificationTokens)
      .where(and(
        eq(phoneVerificationTokens.userId, userId),
        eq(phoneVerificationTokens.used, false),
        gt(phoneVerificationTokens.expiresAt, new Date())
      ))
      .orderBy(desc(phoneVerificationTokens.createdAt))
      .limit(1);

    let valid = false;
    if (isDev && code === "123456") {
      valid = true;
    } else if (token) {
      valid = await comparePassword(code, token.hashedCode);
    }

    if (!valid) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    // Mark token as used
    if (token) {
      await db.update(phoneVerificationTokens)
        .set({ used: true })
        .where(eq(phoneVerificationTokens.id, token.id));
    }

    // Mark user phone as verified
    await db.update(users).set({ phoneVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));

    return res.json({ success: true, message: "Phone number verified successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## Task 4: Backend — Profile Guard (Immutable Name) + Admin Name Override

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 4.1: Guard `PATCH /api/auth/profile` against name changes for CUSTOMER role**

Find the `app.patch("/api/auth/profile"` handler (line ~2394). Replace the handler body with:

```typescript
app.patch("/api/auth/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { firstName, lastName, phone, avatarUrl } = req.body;

    // Customers cannot change their name after initial setup
    if (userRole === "CUSTOMER" && (firstName !== undefined || lastName !== undefined)) {
      return res.status(403).json({
        error: "Name cannot be changed. Please contact support if a correction is needed."
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

    // Return sanitized response — no internal id, no passwordHash
    return res.json({
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      role: updated.role,
      creditBalance: updated.creditBalance,
      avatarUrl: updated.avatarUrl,
      phoneVerified: updated.phoneVerified,
      emailVerified: updated.emailVerified,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4.2: Add admin-only name correction endpoint**

After the `PATCH /api/auth/profile` handler, add:

```typescript
// ── Admin: correct customer name ─────────────────────────────────────────────
app.patch("/api/admin/users/:id/name", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName && !lastName) return res.status(400).json({ error: "Provide firstName or lastName" });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.params.id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });

    await db.insert(adminAuditLogs).values({
      adminId: req.user!.userId,
      action: "UPDATE_USER_NAME",
      resourceType: "USER",
      resourceId: req.params.id,
      changes: { firstName, lastName },
      ipAddress: req.ip,
    });

    return res.json({ success: true, firstName: updated.firstName, lastName: updated.lastName });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4.3: Strip internal IDs from `GET /api/auth/me` response**

Find the `GET /api/auth/me` handler (line ~233). Update the response to not return `id` or `passwordHash` for CUSTOMER role:

```typescript
app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    if (!user) return res.status(401).json({ error: "User not found" });

    const isCustomer = user.role === "CUSTOMER";
    return res.json({
      // Internal id only exposed to non-customers and for system references
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
      phoneVerified: (user as any).phoneVerified ?? false,
      onboardingCompleted: user.onboardingCompleted,
      creditBalance: user.creditBalance,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## Task 5: Backend — Wire Moderation into Jobs, Quotes, Chat

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 5.1: Import moderationService in routes.ts**

At the top of `server/routes.ts`, after the existing filter import line:

```typescript
import { processMessageContent, maskContactInfo } from "./profanityFilter";
```

Add:

```typescript
import { moderateText } from "./moderationService";
```

- [ ] **Step 5.2: Add moderation to `POST /api/jobs` (job creation)**

Find `app.post("/api/jobs"` (line ~391). After extracting `description` from `req.body` and before saving to DB, add:

```typescript
// Moderate job description — phone numbers never allowed in job descriptions
const descModeration = moderateText(description, { fieldName: "job description" });
if (descModeration.blocked) {
  return res.status(422).json({ error: descModeration.userMessage });
}
```

- [ ] **Step 5.3: Add moderation to `POST /api/jobs/:id/publish`**

Find `app.post("/api/jobs/:id/publish"` (line ~633). Before the quality gate check, add the same moderation check on `job.description`:

```typescript
const descMod = moderateText(job.description, { fieldName: "job description" });
if (descMod.blocked) {
  return res.status(422).json({ error: descMod.userMessage });
}
```

- [ ] **Step 5.4: Add moderation to `POST /api/quotes`**

Find `app.post("/api/quotes"` (line ~995). After extracting `message` from `req.body`, add:

```typescript
if (message) {
  const quoteMod = moderateText(message, { fieldName: "quote message" });
  if (quoteMod.blocked) {
    return res.status(422).json({ error: quoteMod.userMessage });
  }
}
```

- [ ] **Step 5.5: Upgrade chat message moderation to block (not just mask)**

Find `app.post("/api/chat/conversations/:id/messages"` (line ~1400). Replace the existing `processMessageContent` call with `moderateText`:

```typescript
// Check if pro has STANDARD unlock for this job (if conversation has a jobId)
let allowPhone = false;
if (conv.jobId) {
  const [unlock] = await db.select().from(jobUnlocks)
    .where(and(
      eq(jobUnlocks.jobId, conv.jobId),
      eq(jobUnlocks.proId, senderId),
      eq(jobUnlocks.tier, "STANDARD")
    ));
  allowPhone = !!unlock?.phoneUnlocked;
}

const modResult = moderateText(content, { allowPhone, fieldName: "message" });
if (modResult.blocked) {
  return res.status(422).json({ error: modResult.userMessage });
}
const processedContent = modResult.cleanedText;
```

---

## Task 6: Backend — Reviews Reply Endpoint

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 6.1: Add `POST /api/reviews/:id/reply` endpoint**

After the existing `GET /api/reviews/given` handler (line ~2301), add:

```typescript
// ── Pro reply to a review ────────────────────────────────────────────────────
app.post("/api/reviews/:id/reply", requireAuth, requireRole("PROFESSIONAL"), async (req: AuthRequest, res: Response) => {
  try {
    const { reply } = req.body;
    if (!reply || reply.trim().length === 0) {
      return res.status(400).json({ error: "Reply text is required" });
    }
    if (reply.trim().length > 1000) {
      return res.status(400).json({ error: "Reply must be under 1000 characters" });
    }

    const [review] = await db.select().from(reviews).where(eq(reviews.id, req.params.id));
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (!review.isVisible) return res.status(404).json({ error: "Review not found" });

    // Ensure this review belongs to this professional
    if (review.revieweeId !== req.user!.userId) {
      return res.status(403).json({ error: "You can only reply to reviews on your own profile" });
    }

    // One reply only — immutable
    if ((review as any).proReply) {
      return res.status(409).json({ error: "You have already replied to this review" });
    }

    // Moderate reply text
    const replyMod = moderateText(reply, { fieldName: "reply" });
    if (replyMod.blocked) {
      return res.status(422).json({ error: replyMod.userMessage });
    }

    const [updated] = await db.update(reviews)
      .set({ proReply: reply.trim(), proRepliedAt: new Date() })
      .where(eq(reviews.id, req.params.id))
      .returning();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6.2: Update `GET /api/reviews` to join reviewer name and pro name**

Replace the existing `GET /api/reviews` handler body to include names:

```typescript
app.get("/api/reviews", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId } = req.query;
    const whereClause = targetUserId
      ? eq(reviews.revieweeId, String(targetUserId))
      : eq(reviews.revieweeId, req.user!.userId);

    const rows = await db
      .select({
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
        reviewerFirstName: sql<string>`reviewer.first_name`,
        reviewerLastName: sql<string>`reviewer.last_name`,
        reviewerAvatarUrl: sql<string>`reviewer.avatar_url`,
        revieweeFirstName: sql<string>`reviewee.first_name`,
        revieweeLastName: sql<string>`reviewee.last_name`,
      })
      .from(reviews)
      .leftJoin(sql`users reviewer`, sql`reviewer.id = ${reviews.reviewerId}`)
      .leftJoin(sql`users reviewee`, sql`reviewee.id = ${reviews.revieweeId}`)
      .where(and(whereClause, eq(reviews.isVisible, true)))
      .orderBy(desc(reviews.createdAt));

    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

---

## Task 7: Backend — Professional Verification: Optional + verificationLevel

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 7.1: Update verification submit to set verificationLevel to SELF_DECLARED on submit, DOCUMENT_VERIFIED on admin approve**

Find `app.post("/api/pro/verification/submit"` (line ~1842). After the existing `verificationStatus: "PENDING"` update, add:

```typescript
verificationLevel: "SELF_DECLARED",
```

Find `app.post("/api/admin/users/:id/verify"` (line ~1862). In the approval branch, after setting `isVerified: true`, add:

```typescript
verificationLevel: approve ? "DOCUMENT_VERIFIED" : "NONE",
```

---

## Task 8: Backend — AI Chat Widget Sandbox

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 8.1: Replace `POST /api/ai/chat` with sandboxed version**

Find `app.post("/api/ai/chat"` (line ~2552). Replace the entire handler:

```typescript
app.post("/api/ai/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history, mode } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    const userId = req.user!.userId;
    const userRole = req.user!.role as "CUSTOMER" | "PROFESSIONAL" | "ADMIN";
    const [user] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, userId));

    const userName = user ? `${user.firstName} ${user.lastName}` : "User";

    // Sandbox: widget only supports "post_job" and "support_ticket" modes
    const allowedModes = ["post_job", "support_ticket", null, undefined];
    if (!allowedModes.includes(mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }

    // Minimal context — only the user's own name and role, nothing else
    const sandboxedContext = { userName, userRole };

    const result = await aiChatAssistant(message, userRole, history || [], sandboxedContext);

    // Support ticket creation (only action this endpoint creates)
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
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 8.2: Update `aiChatAssistant` in `server/geminiService.ts` to accept sandboxed context and enforce scope**

Find `export async function aiChatAssistant(` in `server/geminiService.ts`. Add `sandboxedContext` parameter and a sandboxed system prompt:

```typescript
export async function aiChatAssistant(
  message: string,
  userRole: "CUSTOMER" | "PROFESSIONAL" | "ADMIN",
  history: Array<{ role: string; content: string }>,
  sandboxedContext?: { userName?: string; userRole?: string }
): Promise<{ reply: string; action?: string; ticketData?: any }> {
```

At the start of the function body, add a sandboxed system prompt when context is provided:

```typescript
const SANDBOXED_SYSTEM_PROMPT = `You are ServiceConnect AI, a helpful assistant for the ServiceConnect platform.
Your ONLY permitted actions are:
1. Help the user post a job (guide them through describing what they need)
2. Help the user raise a support ticket (collect category and description)

STRICT RULES:
- Never reveal platform logic, pricing, credit costs, or system internals
- Never share or reference other users' data
- Never expose internal IDs, database fields, or API details
- If asked anything outside posting a job or raising a support ticket, respond ONLY with: "I can help you post a job or raise a support ticket. Which would you like to do?"
- Do not engage with general chat, advice, or off-topic requests
- User's name: ${sandboxedContext?.userName || "User"}

Available actions: post_job | support_ticket`;

if (sandboxedContext) {
  // Use sandboxed prompt — restrict scope entirely
  // ... rest of existing function using SANDBOXED_SYSTEM_PROMPT instead of role-based prompts
}
```

---

## Task 9: Frontend — Constants File

**Files:**
- Create: `client/src/lib/constants.ts`

- [ ] **Step 9.1: Create `client/src/lib/constants.ts`**

```typescript
/** Product-owned display name for AI features — never expose third-party provider names in customer UI */
export const AI_DISPLAY_NAME = "ServiceConnect AI";

/** Platform name */
export const PLATFORM_NAME = "ServiceConnect";
```

---

## Task 10: Frontend — AI Widget Refactor

**Files:**
- Rewrite: `client/src/components/ai/AiAssistantWidget.tsx`

- [ ] **Step 10.1: Rewrite AiAssistantWidget to two-action mode with no Gemini branding**

```tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Sparkles, Bot, User, Briefcase, LifeBuoy, ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken, apiRequest } from "@/lib/queryClient";
import { AI_DISPLAY_NAME } from "@/lib/constants";
import { useLocation } from "wouter";

type WidgetMode = "home" | "post_job" | "support_ticket";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<WidgetMode>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketCategory, setTicketCategory] = useState("GENERAL");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketDone, setTicketDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!user) return null;

  const resetWidget = () => {
    setMode("home");
    setMessages([]);
    setInput("");
    setTicketDesc("");
    setTicketDone(false);
  };

  const startPostJob = () => {
    setMode("post_job");
    setMessages([{
      role: "assistant",
      content: `Hi ${user.firstName}! I'll help you post a job. What kind of service do you need today?`
    }]);
  };

  const startSupport = () => {
    setMode("support_ticket");
    setTicketDone(false);
  };

  const sendJobMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg, history: newMessages.slice(-8), mode: "post_job" }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || "Let me help you with that." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async () => {
    if (!ticketDesc.trim()) return;
    setTicketLoading(true);
    try {
      const res = await apiRequest("POST", "/api/support/tickets", {
        subject: ticketDesc.trim().slice(0, 100),
        description: ticketDesc.trim(),
        category: ticketCategory,
        priority: "MEDIUM",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setTicketDone(true);
    } catch (e: any) {
      alert("Could not submit ticket: " + e.message);
    } finally {
      setTicketLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-2xl hover:shadow-blue-500/25 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          aria-label="Open assistant"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20 backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 animate-in slide-in-from-bottom-4 duration-300" style={{ maxHeight: "520px" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              {mode !== "home" && (
                <button onClick={resetWidget} className="p-1 rounded-full hover:bg-white/20 transition-colors mr-1">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{AI_DISPLAY_NAME}</p>
                <p className="text-xs text-blue-100">
                  {mode === "home" ? "How can I help?" : mode === "post_job" ? "Posting a job" : "Support"}
                </p>
              </div>
            </div>
            <button onClick={() => { setIsOpen(false); resetWidget(); }} className="p-1.5 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Home mode */}
          {mode === "home" && (
            <div className="flex-1 flex flex-col gap-4 p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Hi {user.firstName}! What would you like to do?
              </p>
              <button
                onClick={startPostJob}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Post a Job</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Describe what you need and find pros</p>
                </div>
              </button>
              <button
                onClick={startSupport}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-violet-100 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                  <LifeBuoy className="w-5 h-5 text-violet-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Get Support</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Report an issue or ask for help</p>
                </div>
              </button>
            </div>
          )}

          {/* Post Job chat mode */}
          {mode === "post_job" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "360px" }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-gradient-to-br from-violet-500 to-blue-500 text-white"}`}>
                      {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 px-3.5 py-2.5 rounded-2xl">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-shrink-0">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendJobMessage()}
                  placeholder="Describe what you need..."
                  className="flex-1 h-9 text-sm"
                  disabled={loading}
                />
                <Button size="sm" onClick={sendJobMessage} disabled={loading || !input.trim()} className="h-9 w-9 p-0">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="px-3 pb-3 flex-shrink-0">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate("/post-job")}>
                  Open full job posting form
                </Button>
              </div>
            </div>
          )}

          {/* Support Ticket mode */}
          {mode === "support_ticket" && (
            <div className="flex-1 p-5 flex flex-col gap-4">
              {ticketDone ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <LifeBuoy className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Ticket submitted!</p>
                  <p className="text-xs text-gray-500 text-center">You can track it in the Support section of your dashboard.</p>
                  <Button variant="outline" size="sm" onClick={resetWidget}>Back</Button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">What do you need help with?</p>
                  <select
                    value={ticketCategory}
                    onChange={e => setTicketCategory(e.target.value)}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                  >
                    <option value="GENERAL">General question</option>
                    <option value="BILLING">Billing / payments</option>
                    <option value="JOB">Job issue</option>
                    <option value="PROFESSIONAL">Professional issue</option>
                    <option value="TECHNICAL">Technical problem</option>
                    <option value="SAFETY">Safety concern</option>
                  </select>
                  <textarea
                    value={ticketDesc}
                    onChange={e => setTicketDesc(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={5}
                    className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 resize-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400"
                  />
                  <Button
                    onClick={submitTicket}
                    disabled={ticketLoading || !ticketDesc.trim()}
                    className="w-full"
                    size="sm"
                  >
                    {ticketLoading ? "Submitting..." : "Submit Support Ticket"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
```

---

## Task 11: Frontend — Phone Verification Modal

**Files:**
- Create: `client/src/components/auth/PhoneVerificationModal.tsx`

- [ ] **Step 11.1: Create PhoneVerificationModal component**

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhoneVerificationModalProps {
  open: boolean;
  onVerified: () => void;
  onDismiss?: () => void;
  phone?: string;
}

export default function PhoneVerificationModal({ open, onVerified, onDismiss, phone }: PhoneVerificationModalProps) {
  const [step, setStep] = useState<"send" | "verify">("send");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-phone-otp", {});
      if (!res.ok) throw new Error((await res.json()).error);
      setStep("verify");
      toast({ title: "Code sent", description: "Check your phone for the 6-digit verification code." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-phone-otp", { code });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Phone verified!", description: "Your number has been confirmed." });
      onVerified();
    } catch (e: any) {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && onDismiss?.()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <DialogTitle>Verify your phone number</DialogTitle>
          </div>
          <DialogDescription>
            {step === "send"
              ? `We'll send a code to ${phone || "your phone"} to confirm your identity. This keeps your listing genuine and helps professionals trust your job post.`
              : "Enter the 6-digit code we sent to your phone."}
          </DialogDescription>
        </DialogHeader>

        {step === "send" ? (
          <div className="flex flex-col gap-3 mt-2">
            <Button onClick={sendOtp} disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send verification code"}
            </Button>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="text-gray-500">
                Do this later
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="otp-code">Verification code</Label>
              <Input
                id="otp-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
              />
            </div>
            <Button onClick={verifyOtp} disabled={loading || code.length !== 6} className="w-full">
              {loading ? "Verifying..." : "Confirm code"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep("send")} className="text-gray-500">
              Resend code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Task 12: Frontend — PostJob Phone Verification Gate

**Files:**
- Modify: `client/src/pages/customer/PostJob.tsx`

- [ ] **Step 12.1: Import PhoneVerificationModal and add phone gate for logged-in users**

At the top of `PostJob.tsx`, add the import:

```tsx
import PhoneVerificationModal from "@/components/auth/PhoneVerificationModal";
```

Add state variable near the existing state declarations:

```tsx
const [showPhoneVerify, setShowPhoneVerify] = useState(false);
```

- [ ] **Step 12.2: Add phone verification gate in `handleAccountSubmit` for logged-in users**

In the `if (isLoggedIn)` branch of `handleAccountSubmit`, BEFORE `setStep(2.5)`, add:

```typescript
// Gate: if user hasn't verified phone, show modal first
if (!(user as any).phoneVerified) {
  setShowPhoneVerify(true);
  setLoading(false);
  return;
}
```

- [ ] **Step 12.3: Add PhoneVerificationModal to JSX**

In the return statement of PostJob, before the closing tag, add:

```tsx
<PhoneVerificationModal
  open={showPhoneVerify}
  phone={(user as any)?.phone}
  onVerified={async () => {
    setShowPhoneVerify(false);
    await refreshUser();
    // Retry the submit now that phone is verified
    handleAccountSubmit();
  }}
  onDismiss={() => setShowPhoneVerify(false)}
/>
```

- [ ] **Step 12.4: Make phone mandatory in new user account form**

In the account form (Step 2), find the phone input (line ~599). Ensure the phone field has `required` and update validation in `handleAccountSubmit` for new users:

```typescript
if (!isLoggedIn && !account.phone) {
  toast({ title: "Phone number required", description: "A phone number is needed to verify your identity.", variant: "destructive" });
  setLoading(false);
  return;
}
```

---

## Task 13: Frontend — Customer Settings: Read-Only Name

**Files:**
- Modify: `client/src/pages/customer/Settings.tsx`

- [ ] **Step 13.1: Make firstName/lastName read-only for customers**

In `Settings.tsx`, find the `handleProfileSave` function. Remove `firstName` and `lastName` from the PATCH payload for customers:

```typescript
const handleProfileSave = async (e: React.FormEvent) => {
  e.preventDefault();
  setProfileLoading(true);
  try {
    const isCustomer = user?.role === "CUSTOMER";
    const payload: Record<string, unknown> = {
      phone,
      avatarUrl: avatarUrl || undefined,
    };
    // Professionals can update name; customers cannot
    if (!isCustomer) {
      payload.firstName = firstName;
      payload.lastName = lastName;
    }
    const res = await apiRequest("PATCH", "/api/auth/profile", payload);
    if (!res.ok) throw new Error((await res.json()).error);
    await refreshUser();
    toast({ title: "Profile updated", description: "Your changes have been saved." });
  } catch (e: any) {
    toast({ title: "Error", description: e.message, variant: "destructive" });
  } finally {
    setProfileLoading(false);
  }
};
```

- [ ] **Step 13.2: Replace name input fields with read-only display for customers**

In the JSX of `Settings.tsx`, find the firstName/lastName input group and replace with a conditional:

```tsx
{user?.role === "CUSTOMER" ? (
  <div className="space-y-2">
    <Label>Full Name</Label>
    <div className="flex gap-2">
      <div className="flex-1 px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
        {user.firstName}
      </div>
      <div className="flex-1 px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
        {user.lastName}
      </div>
    </div>
    <p className="text-xs text-gray-400">Name cannot be changed. Contact support if a correction is needed.</p>
  </div>
) : (
  <div className="flex gap-4">
    <div className="flex-1 space-y-2">
      <Label htmlFor="firstName">First Name</Label>
      <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
    </div>
    <div className="flex-1 space-y-2">
      <Label htmlFor="lastName">Last Name</Label>
      <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
    </div>
  </div>
)}
```

---

## Task 14: Frontend — Professional Verification: Optional Copy

**Files:**
- Modify: `client/src/pages/pro/VerificationPending.tsx`

- [ ] **Step 14.1: Update verification page copy to optional framing**

Read `VerificationPending.tsx` and find any language implying verification is required or blocking. Replace headings/descriptions with optional framing:

- Change "Verification Required" → "Boost Your Credibility (Optional)"
- Change "You must verify before..." → "Verified profiles attract more customers and earn a trust badge."
- Add a "Skip for now" or "Continue without verifying" link that navigates to `/pro/dashboard`
- Change button "Submit for Verification" → "Submit Documents (Optional)"

---

## Task 15: Frontend — Reviews: Pro-Scoped Copy + Reply UI

**Files:**
- Modify: `client/src/pages/pro/ProfileEditor.tsx` (or wherever reviews are displayed)

- [ ] **Step 15.1: Find all review display components and update headings**

Search for "Reviews" in the pro profile pages:

```bash
grep -rn "Reviews\|review" client/src/pages/pro/ --include="*.tsx" | grep -v "node_modules"
```

Update review section headings to use pro-specific copy:

```tsx
// Before:
<h3>Reviews</h3>

// After:
<h3>Reviews for {proName}</h3>
// or in customer-facing:
<h3>What customers say about {proName}</h3>
```

- [ ] **Step 15.2: Add review reply UI to pro dashboard reviews section**

Find where reviews are listed for the pro's own profile view. Add a reply button/form per review:

```tsx
{review.proReply ? (
  <div className="mt-3 pl-4 border-l-2 border-blue-200">
    <p className="text-xs font-semibold text-blue-700 mb-1">Your response:</p>
    <p className="text-sm text-gray-600 dark:text-gray-300">{review.proReply}</p>
    <p className="text-xs text-gray-400 mt-1">{review.proRepliedAt ? new Date(review.proRepliedAt).toLocaleDateString() : ""}</p>
  </div>
) : (
  <ReviewReplyForm reviewId={review.id} onReplied={() => refetch()} />
)}
```

- [ ] **Step 15.3: Create ReviewReplyForm inline component**

Add this component in the same file or as a separate file `client/src/components/reviews/ReviewReplyForm.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ReviewReplyForm({ reviewId, onReplied }: { reviewId: string; onReplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submitReply = async () => {
    if (!reply.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/reviews/${reviewId}/reply`, { reply });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Reply submitted", description: "Your response has been posted." });
      onReplied();
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs text-blue-600 hover:underline">
        Respond to this review
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={reply}
        onChange={e => setReply(e.target.value)}
        placeholder="Write a professional response..."
        rows={3}
        maxLength={1000}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submitReply} disabled={loading || !reply.trim()}>
          {loading ? "Posting..." : "Post Response"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p className="text-xs text-gray-400">Your response is permanent and cannot be edited after posting.</p>
    </div>
  );
}
```

---

## Task 16: Implementation Report

**Files:**
- Modify: `implementation_report1.md`

- [ ] **Step 16.1: Update implementation_report1.md**

Write a comprehensive report covering what was built, changed, and any remaining items. See spec for the format.

---

## Task 17: Build Verification

- [ ] **Step 17.1: Type-check the project**

```bash
cd C:/Users/balaj/Downloads/ServiceConnect_EVERYTHING/codebase_full
npm run check 2>&1 | tail -30
```

Expected: No new TypeScript errors introduced by these changes.

- [ ] **Step 17.2: Run dev server smoke test**

```bash
cd C:/Users/balaj/Downloads/ServiceConnect_EVERYTHING/codebase_full
npm run build 2>&1 | tail -30
```

Expected: Build completes without errors.

---

## Task 18: Deploy

- [ ] **Step 18.1: Push schema to Supabase/production DB**

```bash
npm run db:push
```

- [ ] **Step 18.2: Git commit and push**

```bash
git add -A
git commit -m "feat: verification gating, moderation hardening, review reply, AI widget sandbox, profile hardening"
git push origin main
```

- [ ] **Step 18.3: Deploy to Vercel**

```bash
npx vercel --prod
```

Expected: Deployment URL returned, all routes accessible.
