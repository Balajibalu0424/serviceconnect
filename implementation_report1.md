# ServiceConnect — Implementation Report 1
**Date:** 2026-04-05  
**Round:** 2 (builds on IMPLEMENTATION_REPORT.md)  
**Commit:** `cd8cec3` pushed to `Balajibalu0424/serviceconnect` (branch: `main`)  
**Live:** https://codebasefull.vercel.app  
**DB Schema:** Changes applied via `drizzle-kit push`

---

## Summary of This Round

6 product features implemented. 1 partial (OTP UI). 3 deferred. All previous fixes from Round 1 preserved.

---

## What Was Already Built (Round 1 — Preserved)

| Fix | Status |
|---|---|
| Phone delivery after STANDARD unlock (3-layer fix) | ✅ Preserved |
| Chat crash (`io` → Pusher) | ✅ Preserved |
| Aftercare dead end → boost offer → decline → close/leave_open | ✅ Preserved |
| `blockedRepost` set on leave_open | ✅ Preserved |
| Spin DISCOUNT prize redemption at unlock | ✅ Preserved |
| FREE→STANDARD upgrade button on Matchbooked page | ✅ Preserved |
| `canBoost`/`canClose` status gate fixed | ✅ Preserved |
| `profanityFilter` respects `shouldMaskContacts` | ✅ Preserved |

---

## What Was Implemented This Round

### 1. Pro Verification Flow — Full Vertical Slice ✅

**Flowchart requirement:** Trade login → profile creation → verification → access granted to dashboard

#### Schema (`shared/schema.ts`)
Added 5 new columns to `professional_profiles`:
- `verification_status` TEXT — `UNSUBMITTED` | `PENDING` | `APPROVED` | `REJECTED` (default: `UNSUBMITTED`)
- `verification_document_url` TEXT — pro-supplied document link
- `verification_submitted_at` TIMESTAMP
- `verification_reviewed_at` TIMESTAMP
- `verification_review_note` TEXT — admin rejection reason

Schema pushed to production DB via `drizzle-kit push`.

#### Backend (`server/routes.ts`)
**New endpoint:** `POST /api/pro/verification/submit`
- Auth: `PROFESSIONAL` role
- Body: `{ documentUrl: string, licenseNumber?: string }`
- Sets `verificationStatus = "PENDING"`, stores document URL and submitted timestamp
- Returns 409 if already `APPROVED`
- Sends in-app notification to the pro

**New endpoint:** `POST /api/admin/users/:id/verify`
- Auth: `ADMIN` role
- Body: `{ approved: boolean, note?: string }`
- Sets `isVerified`, `verificationStatus`, `verificationReviewedAt`, `verificationReviewNote`
- Creates admin audit log entry
- Sends in-app notification to pro (approved or rejected with reason)

**Updated:** `GET /api/admin/users`
- Now attaches `proVerification` object (`isVerified`, `verificationStatus`, `documentUrl`, `submittedAt`, `reviewNote`) to each PROFESSIONAL user row

#### Frontend — New Page (`client/src/pages/pro/VerificationPending.tsx`)
Full page shown to unverified pros instead of dashboard. Three states:
- **UNSUBMITTED**: Document URL input + license number + submit button
- **PENDING**: "Under review" message, amber badge, notification info
- **REJECTED**: Rejection reason shown, re-submit form pre-populated with prior URL

Sign out button always visible.

#### Frontend — Admin Users (`client/src/pages/admin/Users.tsx`)
- Added `verifyPro` mutation (calls `POST /api/admin/users/:id/verify`)
- **PENDING pros**: Show green "Approve" + red "Reject" buttons
- **APPROVED pros**: Show green "Verified" badge
- **REJECTED pros**: Show "Rejected" indicator
- **UNSUBMITTED**: Show "Not submitted" text
- Verification pending status shown inline in user info row

#### Frontend — Route Gating (`client/src/App.tsx`)
- `ProtectedRoute` gains `requireVerified?: boolean` prop
- All core pro routes now use `requireVerified`: `/pro/dashboard`, `/pro/feed`, `/pro/matchbooked`, `/pro/leads`, `/pro/bookings`, `/pro/chat`, `/pro/spin`
- Non-gated pro routes (no requireVerified): `/pro/profile`, `/pro/credits`, `/pro/verification-pending`
- Unverified pros accessing gated routes → redirected to `/pro/verification-pending`
- New route: `/pro/verification-pending` → `ProVerificationPending`

**How to test:**
1. Register a new pro via `/pro/onboarding` → seeds with `verificationStatus = "UNSUBMITTED"`, `isVerified = false`
2. Login as that pro → redirected to `/pro/verification-pending`
3. Submit document URL → status changes to PENDING, notification sent
4. Login as admin (`admin@serviceconnect.ie` / `admin123456`) → go to `/admin/users` → filter by PROFESSIONAL
5. Find the pro with "Verification pending" label → click "Approve"
6. Pro can now access dashboard

> **Note on existing seeded pros:** `pro1@test.com`, `pro2@test.com`, `pro3@test.com` were seeded with `isVerified: true`. They are unaffected and retain full access. Any newly registered pro will go through the verification gate.

---

### 2. FREE → STANDARD Upgrade in Job Feed ✅

**What was missing:** Round 1 added the upgrade button to Matchbooked page. Job feed showed FREE-unlocked jobs without any upgrade path.

**File changed:** `client/src/pages/pro/JobFeed.tsx`
- Added `upgrade` mutation (calls `POST /api/jobs/:id/upgrade`)
- FREE-unlocked jobs in the feed now show **"Get phone (X cr)"** button alongside the Chat button
- On success: invalidates feed, toast shows phone number
- STANDARD-unlocked jobs continue showing phone inline as before

**How to test:**
1. Login as pro → Job feed → claim a job with FREE tier
2. The unlocked job card shows "Get phone (X cr)" button
3. Click → credits deducted, phone shown in toast, feed refreshes with phone visible

---

### 3. Review Flow Auto-Opens After 5-Day Sorted Close ✅

**What was missing:** `reviewPrompt: true` from the API was only showing a toast. The review form existed on the page but required the user to manually click "Leave a review" — not discoverable.

**File changed:** `client/src/pages/customer/JobDetail.tsx`
- `respondAftercare` `onSuccess`: when `data.reviewPrompt === true`, now calls `setShowReview(true)` to auto-open the review form
- Toast updated to say "Glad it got sorted — leave a review for the professional"

**How to test:**
1. Set a job to `AFTERCARE_5D` status (scheduler or manual DB update)
2. Customer clicks "Yes, sorted!" on job detail
3. Review form opens automatically
4. Submit rating + comment → calls `POST /api/bookings/:id/review`
5. Pro's `ratingAvg` and `totalReviews` update

---

### 4. Home Page — Distinct Customer & Pro Entry Points ✅

**Flowchart requirement:** Home page has two distinct paths — customer and pro

**File changed:** `client/src/pages/public/Home.tsx`

**Nav bar:** Now has three buttons:
- "Sign In" (ghost) → `/login`
- "I'm a Pro" (violet outline) → `/pro/onboarding`
- "Post a Job" (gradient) → `/post-job`

**Hero section:** Replaced the single CTA button pair with two entry cards:
- **"I need a Pro"** card (blue) → `/post-job` — "Post your job free. Get matched with verified local professionals."
- **"I'm a Professional"** card (violet) → `/pro/onboarding` — "Find local leads, unlock contact details with credits, grow your business."

**CTA section:** "Join as a Professional" button now correctly links to `/pro/onboarding` (was `/register`)

---

### 5. Spin Wheel Teaser on Home Page ✅

**Flowchart requirement:** Spin wheel as a third entry point / incentive visible from home

**File changed:** `client/src/pages/public/Home.tsx`
- Added amber-themed section above the final CTA: "Daily Spin — Win Free Credits"
- Shows dice icon, describes the 72-hour spin prize mechanic
- "Join to Spin" button → `/pro/onboarding` (gates spin behind pro login as required)
- Clearly labelled "For Professionals"

---

### 6. OTP Expiry / Resend UI (Partial — Demo-Safe) ✅ (partial)

**What was built:** OTP step extracted into `OtpStep` component in `PostJob.tsx` with:
- 60-second countdown timer after clicking "Resend code"
- "Resend code" button becomes active after cooldown
- Input sanitised to digits only
- Demo mode banner clearly labels `123456` as the code

**What was NOT built:** Real email delivery — the resend button does not call any backend endpoint. It resets the countdown and shows a toast. This is intentional: real OTP requires SendGrid/Resend integration (deferred).

**File changed:** `client/src/pages/customer/PostJob.tsx`
- Added `OtpStep` component (before main export)
- Uses `useEffect` for countdown, `useToast` for feedback
- Replaces inline OTP JSX in the step-3 render block

---

## Intentionally Deferred (Not Implemented This Round)

| Item | Reason |
|---|---|
| **Real email OTP** (SendGrid/Resend) | Requires external email provider credentials and infra setup. Deferred per explicit instruction. Demo mode (`123456`) preserved. |
| **Stripe credit purchase** | Requires Stripe.js Elements integration and webhook handler. Deferred per explicit instruction. Current mock (instant credit add) preserved. |
| **Stripe boost payment** (€4.99) | Same as above. Boost applies without real charge. Deferred per explicit instruction. |
| **Profile boost feed ranking** | Requires changing job feed sort order. Low risk but not critical path. Deferred per explicit instruction. |

---

## What Still Remains Pending (Not Yet Built)

| Item | Notes |
|---|---|
| Real email OTP delivery | SendGrid/Resend integration — deferred |
| Stripe credit purchase wiring | Stripe.js + webhook — deferred |
| Stripe boost payment | Stripe PaymentIntent — deferred |
| Profile boost feed sort effect | `profileBoostUntil` not used in feed query |
| Pro verification email on approve/reject | Notification sent in-app; email not sent (requires email infra) |
| OTP resend actually calls backend | Stub only — deferred with email infra |

---

## Files Changed This Round

| File | Change |
|---|---|
| `shared/schema.ts` | +5 columns to `professional_profiles` |
| `server/routes.ts` | +2 new endpoints, updated admin users endpoint |
| `client/src/App.tsx` | `ProtectedRoute` + `requireVerified`, new `/pro/verification-pending` route |
| `client/src/pages/pro/VerificationPending.tsx` | **New file** — verification submit/status page |
| `client/src/pages/admin/Users.tsx` | `verifyPro` mutation, Approve/Reject buttons, verification status display |
| `client/src/pages/pro/JobFeed.tsx` | `upgrade` mutation + "Get phone" button for FREE-unlocked jobs |
| `client/src/pages/public/Home.tsx` | Dual entry cards, pro nav button, spin wheel teaser section |
| `client/src/pages/customer/PostJob.tsx` | `OtpStep` component with countdown + resend stub |
| `client/src/pages/customer/JobDetail.tsx` | `reviewPrompt` now auto-opens review form |

---

## Schema / DB Changes

```sql
-- Applied via drizzle-kit push to production Supabase DB
ALTER TABLE professional_profiles ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'UNSUBMITTED';
ALTER TABLE professional_profiles ADD COLUMN verification_document_url TEXT;
ALTER TABLE professional_profiles ADD COLUMN verification_submitted_at TIMESTAMP;
ALTER TABLE professional_profiles ADD COLUMN verification_reviewed_at TIMESTAMP;
ALTER TABLE professional_profiles ADD COLUMN verification_review_note TEXT;
```

---

## New API Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/pro/verification/submit` | PROFESSIONAL | Submit document URL for verification |
| POST | `/api/admin/users/:id/verify` | ADMIN | Approve or reject pro verification |

---

## How to Test — New Features

### Pro Verification End-to-End
```
1. Register new pro: /pro/onboarding
2. Login → redirected to /pro/verification-pending (not dashboard)
3. Paste a document URL → click "Submit for Verification"
4. Status shows "Under review"
5. Login as admin (admin@serviceconnect.ie / admin123456)
6. Go to /admin/users → filter PROFESSIONAL
7. Find pro with "Verification pending" → click "Approve"
8. Pro receives in-app notification
9. Pro logs in → redirected to /pro/dashboard (access granted)
```

### Upgrade Button in Feed
```
1. Login as pro1@test.com
2. Go to /pro/feed
3. Unlock any job with FREE tier
4. On the unlocked job card: click "Get phone (X cr)"
5. Credits deducted, phone number shown in toast + card
```

### Review Auto-Open
```
1. Login as alice@test.com
2. Have a job in AFTERCARE_5D state (or manually set in DB)
3. Go to job detail → click "Yes, sorted!"
4. Review form opens automatically
5. Select stars, add comment → Submit
```

### Home Page Entry Points
```
1. Visit / (home)
2. Nav shows: Sign In | I'm a Pro | Post a Job
3. Hero shows two cards: "I need a Pro" and "I'm a Professional"
4. Spin wheel teaser section visible above CTA
5. "I'm a Professional" card → /pro/onboarding
6. "Post a Job" / "I need a Pro" card → /post-job
```

### OTP Resend UI
```
1. Start job post as new user → reach OTP step
2. Demo banner shows "use code: 123456"
3. Click "Resend code" → 60s countdown starts
4. After 60s → "Resend code" link returns
```

---

## Known Issues / Assumptions

1. **Existing seeded pros bypass verification gate** — `pro1@test.com`, `pro2@test.com`, `pro3@test.com` have `isVerified = true` in seed data. They are not affected by the gate. This is intentional for demo purposes.

2. **Verification document is a URL, not an upload** — No file upload infra exists. Pros paste a link to Google Drive/Dropbox. This is a pragmatic choice avoiding S3/storage setup.

3. **Admin rejection note is hardcoded to "Documents not sufficient"** for the Reject button. A future improvement would show a text input. Admin can use `POST /api/admin/users/:id/verify` directly with a custom note.

4. **Pro profile and credits pages do not require verification** — intentional so unverified pros can complete their profile and purchase credits while pending review.

5. **`reviewPrompt` auto-open requires an active booking** — if no booking exists for the job, `POST /api/bookings/:id/review` will 404. The review button is already gated on `isCompleted` status in the UI.

6. **OTP resend stub** — clicking resend does not send any email. It resets the UI countdown only. This is clearly labelled in the component as a demo-mode stub.

---

## Round 3 — Platform Refinements (2026-04-07)

### What Was Built

**1. Customer Phone Verification Gate**
- `phoneVerified` column added to `users` table
- `phone_verification_tokens` table: hashed OTPs with 10-minute expiry
- `POST /api/auth/send-phone-otp` + `POST /api/auth/verify-phone-otp` endpoints
- `PhoneVerificationModal` component: two-step modal (send → verify) for logged-in users
- `PostJob.tsx`: gate fires before publish if `phoneVerified = false`; skipped if already verified
- New users: phone field mandatory before onboarding proceeds

**2. Customer Profile Hardening**
- `PATCH /api/auth/profile`: returns 403 if CUSTOMER tries to change firstName/lastName
- `GET /api/auth/me`: strips internal `id` from customer-facing response
- `PATCH /api/admin/users/:id/name`: admin-only name correction with audit log
- `Settings.tsx`: name shown as read-only display for customers with explanatory note

**3. Unified Contact-Sharing Moderation**
- `server/moderationService.ts`: single `moderateText(text, options)` utility
- Covers: direct numbers, spaced digits, written number words (6+ sequence), mixed patterns, separator bypass, partial obfuscation
- Applied to: job descriptions, quote messages, chat messages
- Behaviour: block (HTTP 422) — not warn or mask
- Chat phone allowed only with confirmed STANDARD-tier unlock (`phoneUnlocked = true`)

**4. Reviews — Pro-Scoped, Reply Capable**
- `proReply` and `proRepliedAt` columns added to `reviews` table
- `POST /api/reviews/:id/reply`: professional-only, one reply per review, immutable
- `GET /api/reviews`: enriched with reviewer/reviewee names
- `ProProfile.tsx`: heading → "What customers say about [Name]"; pro replies displayed
- `ProfileEditor.tsx`: reviews management section with `ReviewReplyForm` component
- `ReviewReplyForm`: single-use, permanent after submit, 1000-char limit

**5. AI Branding**
- `client/src/lib/constants.ts`: `AI_DISPLAY_NAME = "ServiceConnect AI"`
- `AiAssistantWidget.tsx`: "Powered by Gemini" removed; product-owned name throughout

**6. AI Widget — Sandboxed 2-Action Mode**
- Widget rewritten: home screen → "Post a Job" or "Get Support" buttons only
- Post Job: AI chat for description, links to full `/post-job`
- Support: category + description → `POST /api/support/tickets`
- Backend: only `{ userName, userRole }` passed to Gemini; `aiChatWidgetSandboxed()` enforces scope
- Out-of-scope queries return: "I can help you post a job or raise a support ticket."

**7. Professional Verification — Optional**
- `verificationLevelEnum` + `verificationLevel` column on `professional_profiles`
- Submit → `SELF_DECLARED`; admin approve → `DOCUMENT_VERIFIED`; reject → `NONE`
- `VerificationPending.tsx`: full optional framing, "Boost Your Credibility (Optional)"
- No access blocking gate; skip button prominent

### Files Changed (Round 3)
- `shared/schema.ts` — 4 schema additions
- `server/moderationService.ts` — new file
- `server/routes.ts` — 8+ endpoint additions/modifications
- `server/geminiService.ts` — sandbox function + signature update
- `client/src/lib/constants.ts` — new file
- `client/src/components/ai/AiAssistantWidget.tsx` — full rewrite
- `client/src/components/auth/PhoneVerificationModal.tsx` — new file
- `client/src/components/reviews/ReviewReplyForm.tsx` — new file
- `client/src/pages/customer/PostJob.tsx` — phone gate + mandatory phone
- `client/src/pages/customer/Settings.tsx` — name read-only for customers
- `client/src/pages/pro/ProfileEditor.tsx` — reviews management section
- `client/src/pages/pro/VerificationPending.tsx` — optional framing
- `client/src/pages/public/ProProfile.tsx` — pro-scoped review copy + pro replies

### Remaining Pending (Round 3)
1. **SMS provider** (Twilio) for production phone OTP — dev uses console log + master code `123456`
2. **Verified badge display** on pro cards — `verificationLevel` stored, display not yet wired
3. **DB migration** — run `npm run db:push` before deploying
4. **GDPR retention policy** — document phone storage purpose

### Known Limitations (Round 3)
- Pre-existing Drizzle TS2769 errors in routes.ts (~50 lines) are unchanged and pre-date this work
- Phone OTP sends no real SMS in current state — production requires SMS provider integration
- AI widget job posting guides description only; full posting completion happens at /post-job
