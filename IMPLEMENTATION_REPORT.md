# ServiceConnect — Full Implementation Report
**Date:** 2026-04-05  
**Based on:** QA Audit Report (`audit as per fc.md`) vs product flowchart  
**Codebase:** `codebase_full/` — React 18 + Express + PostgreSQL + Pusher  
**Live URL:** https://codebasefull.vercel.app  
**Commit:** `34b1713` — pushed to `Balajibalu0424/serviceconnect` (branch: `main`)

---

## Part 1 — What Was Implemented (Done)

### P0 — BUG-02: Phone Number Never Delivered After STANDARD Unlock ✅

**Root cause:** Three independent layers all suppressed the phone:
1. `GET /api/jobs/:id` hardcoded `customer: { phone: undefined }` for all pros
2. `profanityFilter.ts` called `maskContactInfo()` unconditionally, ignoring the `shouldMaskContacts` parameter
3. Chat message endpoint had `let shouldMask = true` hardcoded — masked phone in all messages

**Files changed:**
- `server/routes.ts` — job detail endpoint now queries `jobUnlocks` for the requesting pro; returns `customer.phone` only if `phoneUnlocked = true`
- `server/routes.ts` — job feed endpoint attaches `customerPhone` to the unlock object when `phoneUnlocked = true`
- `server/routes.ts` — unlock endpoint now returns `customerPhone` in the STANDARD tier success response
- `server/routes.ts` — messages endpoint: `shouldMask` now queries DB for a STANDARD unlock; only masks if none found
- `server/profanityFilter.ts` — wrapped `maskContactInfo()` in `if (shouldMaskContacts)` so the parameter is respected

---

### P0 — BUG-03: Chat API Crashes on Every Message ✅

**Root cause:** `io.to(conversationId).emit(...)` — `io` (socket.io) was never declared. The app uses Pusher, not socket.io. Every `POST /api/chat/conversations/:id/messages` threw `ReferenceError: io is not defined`.

**File changed:**
- `server/routes.ts` — replaced with `pusher.trigger(\`private-conversation-${convId}\`, "new_message", msg)` with non-fatal error catch

---

### P1 — BUG-06: Aftercare UI Dead End After NOT_SORTED ✅

**Root cause:**
- API correctly returned `{ action: "boost_offered" }` but both `JobDetail.tsx` and `Dashboard.tsx` ignored the `action` field
- No `decline-boost` endpoint existed — no path to close or leave the job open after declining boost
- `respondAftercare.mutate()` was passing strings (`"SORTED"/"NOT_SORTED"`) but API expects `{ sorted: boolean }`

**Files changed:**
- `server/routes.ts` — new endpoint `POST /api/jobs/:id/aftercare/decline-boost` accepts `{ action: "close" | "leave_open" }`; `leave_open` sets `blockedRepost = true` and closes the aftercare record without closing the job; `close` sets status to `CLOSED`
- `client/src/pages/customer/Dashboard.tsx` — `AftercareCard` rewritten with full 3-step state machine: sorted prompt → boost offer card → decline options card (Close / Leave it open / Back). Added `useState`, `acceptBoost` mutation, `declineBoost` mutation
- `client/src/pages/customer/JobDetail.tsx` — same boost/decline flow added; fixed `respondAftercare` parameter from string to boolean

---

### P1 — BUG-07: Boost and Close Buttons Never Shown ✅

**Root cause:** `canBoost` and `canClose` in `JobDetail.tsx` checked for status `"OPEN"` which does not exist in the schema.

**File changed:**
- `client/src/pages/customer/JobDetail.tsx` — `canBoost`: now checks `["LIVE", "IN_DISCUSSION", "BOOSTED"]`; `canClose`: now checks `["LIVE", "IN_DISCUSSION", "MATCHED", "BOOSTED"]`

---

### P2 — BUG-10: Spin Wheel DISCOUNT Prize Never Redeemed ✅

**Root cause:** `spinWheelEvents` stored DISCOUNT prizes with `prizeApplied = false` permanently. The unlock endpoint never checked for pending discounts.

**File changed:**
- `server/routes.ts` — at STANDARD unlock, queries for the pro's oldest unapplied DISCOUNT prize; if found, applies the percentage (`Math.floor`, min 1 credit); marks `prizeApplied = true` inside the same DB transaction; notes "spin discount applied" in credit transaction description

---

### P2 — BUG-15: `blockedRepost` Never Set ✅

**Root cause:** The `blockedRepost` field existed in the schema and was checked on job post — but never set through any UI path.

**File changed:**
- `server/routes.ts` — `decline-boost` endpoint's `leave_open` action now sets `blockedRepost = true`, enforcing the flowchart rule: *"user will not be able to post same job back on platform again"*

---

### New Feature — FREE → STANDARD Upgrade Path ✅

**Flowchart requirement:** *"If later pro wants phone number, they can pay the credits difference and get phone number unlocked"*

**What was missing:** `POST /api/jobs/:id/upgrade` existed on the backend (correct logic: credit difference deduction, `phoneUnlocked = true`, system message in chat) but had no UI entry point.

**Files changed:**
- `server/routes.ts` — matchbooked endpoint now attaches `unlock` data (with `customerPhone`) to each row; upgrade endpoint now returns `customerPhone` in success response
- `client/src/pages/pro/Matchbooked.tsx` — FREE-unlocked jobs show "Upgrade for phone (X cr)" button; STANDARD-unlocked jobs show the phone number inline as a green pill

---

### Already Correct — Audit Was Based on Old Deployment

| Audit Finding | Reality |
|---|---|
| BUG-01: Login redirect missing | Already coded in `Login.tsx` — reads JWT role, calls `setLocation` |
| BUG-04: FREE tier sets `hasTokenPurchases = true` | Already gated inside `if (creditsToSpend > 0)` — STANDARD only |
| BUG-05: Boost formula uses `Math.ceil` | Code already uses `Math.round` — 2-credit jobs correctly reduce |
| BUG-08: Spin wheel nav → 404 | Nav link already correct at `/pro/spin` |
| BUG-09: Feature flags nav → 404 | Nav link already correct at `/admin/flags` |
| No FREE tier button in job feed | `UnlockModal` in `JobFeed.tsx` already has FREE + STANDARD buttons |

---

## Part 2 — What Still Needs to Be Implemented

These are the remaining open items from the audit. Ordered by priority.

---

### MUST DO — P0/P1: Real Email OTP

**Flowchart:** Customer → email verification → job goes live  
**Current state:** OTP is hardcoded as `"123456"` in `server/routes.ts:335-337`. Real users receive no email. Only works in demo mode.

**What to build:**
1. Generate a random 6-digit code on `POST /api/auth/send-otp`
2. Create an `email_otps` table:
   ```sql
   CREATE TABLE email_otps (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id VARCHAR REFERENCES users(id) NOT NULL,
     otp_code VARCHAR(6) NOT NULL,
     expires_at TIMESTAMP NOT NULL,
     used BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
3. Send OTP via SendGrid/Mailgun/Resend
4. On verify: check DB record, enforce 15-minute expiry, mark `used = true`
5. Remove hardcoded `"123456"` fallback

**Files to change:** `server/routes.ts` (send-otp + verify-email endpoints), new email service file, `shared/schema.ts`

---

### MUST DO — P1: Pro Verification Flow

**Flowchart:** Trade login → profile creation → **verification** → access granted to dashboard  
**Current state:** `isVerified` column exists and defaults to `false`. All seeded pros have it manually set to `true`. No endpoint for a pro to submit verification. No admin UI to approve. No gate on any route — unverified pros have full dashboard access.

**What to build:**

*Backend:*
- `POST /api/pro/verification/submit` — pro uploads document URL + license number; sets `verificationStatus = 'PENDING'`
- `POST /api/admin/users/:id/verify` — admin approves/rejects; sets `isVerified = true/false`, sends notification to pro
- Add `verificationStatus`, `verificationDocumentUrl`, `verificationSubmittedAt`, `verificationReviewedAt` columns to `professionalProfiles`

*Frontend:*
- Pro onboarding step: document upload + submit button, shows pending/approved/rejected status
- Admin users page: "Approve" / "Reject" buttons next to unverified pros
- `App.tsx` ProtectedRoute: gate all `/pro/*` routes on `isVerified === true`; redirect to a "pending verification" screen if not yet approved

**Files to change:** `server/routes.ts`, `shared/schema.ts`, `client/src/pages/public/ProOnboarding.tsx`, `client/src/pages/admin/Users.tsx`, `client/src/App.tsx`

---

### MUST DO — P1: Stripe Credit Purchase

**Current state:** `POST /api/credits/purchase` skips Stripe entirely and adds credits instantly with a fake `pi_test_...` ID. The card form in `Credits.tsx` collects card details but sends nothing to Stripe.

**What to build:**
1. Use the existing `POST /api/credits/stripe/payment-intent` endpoint (already creates a real Stripe PaymentIntent)
2. Wire `Credits.tsx` to use Stripe.js / Elements to tokenise the card
3. Confirm the PaymentIntent on the client before calling the server to credit the account
4. Handle webhook `payment_intent.succeeded` to add credits server-side (prevents race conditions)

**Files to change:** `client/src/pages/pro/Credits.tsx`, `server/routes.ts` (webhook handler)

---

### MUST DO — P1: Stripe Boost Payment

**Current state:** `POST /api/jobs/:id/boost` charges €4.99 and applies the boost without any real payment — the `paymentMethod: "stripe"` field is a placeholder, no Stripe charge happens.

**What to build:**
1. Create a Stripe PaymentIntent for €4.99 before applying the boost
2. Confirm payment on the client
3. Only apply boost (status → BOOSTED, creditCost reduced) after payment confirmed
4. Store real `stripePaymentId` on the payment record

**Files to change:** `server/routes.ts` (boost endpoint), `client/src/pages/customer/JobDetail.tsx` (boost confirmation with payment)

---

### P2: Pro Verification Gate on Dashboard

**Current state:** `App.tsx` ProtectedRoute only checks `role === "PROFESSIONAL"`, ignores `isVerified`. Unverified pros access everything.

**What to build:**
- After implementing the verification flow above, add an `isVerified` check in the ProtectedRoute for all `/pro/*` routes
- If `isVerified === false`: redirect to a "Verification pending" page instead of the dashboard
- If `verificationStatus === 'UNSUBMITTED'`: redirect to onboarding verification step

**Files to change:** `client/src/App.tsx`, new `client/src/pages/pro/VerificationPending.tsx`

---

### P2: Profile Boost Affects Job Feed Ranking

**Current state:** Spin wheel PROFILE_BOOST prize sets `professionalProfiles.profileBoostUntil` timestamp — but the job feed query does not use it. Being "boosted" has no visible effect.

**What to build:**
- Job feed query (`GET /api/jobs/feed`) should sort jobs where the assigned pro (or jobs posted by pros with active boost) rank higher
- Alternatively: boosted pros' unlocked jobs should appear first for other pros browsing
- Check `profileBoostUntil > NOW()` in the feed sort

**Files to change:** `server/routes.ts` (feed query `orderBy`)

---

### P3: Separate Trade Login / Home Page Entry Points

**Flowchart:** Home page has three distinct entry paths — Customer, Trade/Pro, Spin Wheel  
**Current state:** Single login form for all roles. No separate CTAs on home.

**What to build:**
- Home page: Two distinct CTAs — "Post a Job" (customer) and "Sign in as a Pro" (professional)
- Optionally: a spin wheel teaser or preview visible from home
- The login form itself can remain unified — the distinction is entry point UX, not auth logic

**Files to change:** `client/src/pages/public/Home.tsx` (or equivalent landing page)

---

### P3: Spin Wheel Entry from Home Page

**Flowchart:** Third entry path from home — "probably is low" → spin wheel  
**Current state:** Spin wheel only accessible at `/#/pro/spin` after pro login. No home page presence.

**What to build:**
- A teaser card or CTA on the home page pointing to the spin wheel
- Gate behind pro login (redirect to login if not authenticated as a pro)

**Files to change:** `client/src/pages/public/Home.tsx`

---

### P3: Review After Job Close (5-Day Branch) — Verify End-to-End

**Current state:** `POST /api/jobs/:id/review` exists. `reviewPrompt: true` is returned in the 5-day sorted response. But this path was not tested end-to-end in the audit due to no 5-day aftercare jobs being available.

**What to verify/build:**
- Confirm `reviewPrompt: true` in the 5-day sorted response triggers a review modal in `JobDetail.tsx` / `Dashboard.tsx`
- If the modal doesn't exist yet: add a simple star rating + comment form that calls `POST /api/jobs/:id/review`
- Confirm review affects `professionalProfiles.ratingAvg`

**Files to check:** `client/src/pages/customer/JobDetail.tsx` (review modal), `server/routes.ts` (review endpoint)

---

### P3: FREE → STANDARD Upgrade in Job Feed (Pro Side)

**Current state:** The upgrade button was added to the Matchbooked page. But pros can also view their unlocked jobs directly from the job feed — no upgrade button there.

**What to build:**
- In `JobFeed.tsx`, for jobs where `job.unlock?.tier === "FREE"`, show "Upgrade for phone (X cr)" button alongside the existing "Open chat" button
- Reuse the same `POST /api/jobs/:id/upgrade` mutation

**Files to change:** `client/src/pages/pro/JobFeed.tsx`

---

### P3: OTP Expiry UI Feedback

**Current state:** The OTP input in `PostJob.tsx` has no timer or resend button.

**What to build:**
- Countdown timer showing OTP expiry (15 minutes)
- "Resend code" button that calls the send-otp endpoint again
- Clear error message when OTP has expired vs when it's incorrect

**Files to change:** `client/src/pages/customer/PostJob.tsx`

---

## Part 3 — Architecture Reference for Remaining Work

### Database Schema Changes Needed

```sql
-- Email OTP table (for real OTP delivery)
CREATE TABLE email_otps (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pro verification fields (add to professional_profiles)
ALTER TABLE professional_profiles
  ADD COLUMN verification_status VARCHAR(20) DEFAULT 'UNSUBMITTED',
  ADD COLUMN verification_document_url TEXT,
  ADD COLUMN verification_submitted_at TIMESTAMP,
  ADD COLUMN verification_reviewed_at TIMESTAMP,
  ADD COLUMN verification_reviewer_id VARCHAR REFERENCES users(id);

-- Index for phone unlock checks (performance)
CREATE INDEX idx_job_unlocks_pro_job_phone
ON job_unlocks (professional_id, job_id, phone_unlocked);
```

### New API Endpoints Needed

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/pro/verification/submit` | PROFESSIONAL | Submit verification docs |
| POST | `/api/admin/users/:id/verify` | ADMIN | Approve/reject pro verification |
| POST | `/api/auth/resend-otp` | — | Resend verification email |
| POST | `/api/credits/stripe/confirm` | PROFESSIONAL | Confirm Stripe payment + add credits |
| GET | `/api/credits/stripe/webhook` | Stripe | Handle payment webhooks |

### Business Logic Rules (Must Enforce in Code)

1. STANDARD unlock must always return `customerPhone` in the API response
2. `GET /api/jobs/:id` must return `customer.phone` if `jobUnlocks.phoneUnlocked = true` for the requesting pro
3. Chat messages must NOT mask phone if `phoneUnlocked = true` for that conversation's job
4. Only STANDARD unlocks set `hasTokenPurchases = true` — FREE unlocks do not count
5. `blockedRepost = true` is set when customer chooses "Leave job open" in aftercare
6. A pro must have `isVerified = true` to access `/pro/dashboard` and all pro routes
7. Spin DISCOUNT prize must be marked `prizeApplied = true` when applied at unlock (already done)
8. `sorted: false` in aftercare must always present a boost offer UI — never a dead end
9. OTP must be randomly generated, stored in DB with 15-minute expiry, sent via email
10. Boost payment of €4.99 must be a real Stripe charge before the boost is applied

---

## Part 4 — Build & Deployment Status

```
✓ Build         Clean — zero new TypeScript errors
✓ GitHub        Pushed to Balajibalu0424/serviceconnect (commit 34b1713)
✓ Database      No schema changes — drizzle-kit push: "No changes detected"
✓ Vercel        Deployed → https://codebasefull.vercel.app
```

### Test Accounts

| Role | Email | Password | OTP |
|---|---|---|---|
| Customer | alice@test.com | password123 | 123456 |
| Customer | bob@test.com | password123 | 123456 |
| Pro | pro1@test.com | password123 | — |
| Pro | pro2@test.com | password123 | — |
| Admin | admin@serviceconnect.ie | admin123456 | — |

---

## Part 5 — Priority Order for Remaining Work

| # | Item | Priority | Effort |
|---|---|---|---|
| 1 | Real email OTP (SendGrid/Resend integration) | P0/P1 | ~1 day |
| 2 | Stripe credit purchase (wire card form to Stripe.js) | P1 | ~1 day |
| 3 | Stripe boost payment (€4.99 real charge) | P1 | ~0.5 day |
| 4 | Pro verification submit endpoint + DB columns | P1 | ~1 day |
| 5 | Admin verify pro button + approval endpoint | P1 | ~0.5 day |
| 6 | Pro onboarding verification step (doc upload UI) | P1 | ~1 day |
| 7 | `isVerified` gate on ProtectedRoute + pending screen | P2 | ~0.5 day |
| 8 | Profile boost feed ranking effect | P2 | ~0.5 day |
| 9 | Review modal after 5-day sorted close | P3 | ~0.5 day |
| 10 | FREE→STANDARD upgrade button in job feed | P3 | ~0.5 day |
| 11 | Separate home page CTAs (customer vs pro) | P3 | ~0.5 day |
| 12 | OTP expiry timer + resend button in PostJob | P3 | ~0.5 day |
| 13 | Spin wheel teaser on home page | P3 | ~0.5 day |

**Estimated remaining work: ~8–9 days of focused engineering**

Items 1–3 (real payments + real email) are the only true blockers before real users can pay real money.  
Items 4–7 (verification) are required before pros can self-onboard without manual DB edits.  
Items 8–13 are polish and flowchart completeness — can ship post-launch.
