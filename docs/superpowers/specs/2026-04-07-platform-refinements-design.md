# ServiceConnect Platform Refinements — Design Spec
**Date:** 2026-04-07  
**Status:** Approved  
**Scope:** Production refinement pass across 8 areas

---

## Overview

This spec covers a focused set of trust, safety, UX, and compliance improvements to the ServiceConnect marketplace platform. The platform foundation (AI job posting, credit system, real-time chat, professional onboarding) is stable. These changes harden identity verification, moderation, data privacy, AI safety, and review integrity.

---

## Area 1: Customer Job Posting — Phone Verification Gate

### Problem
Ghost leads (unverified customers posting fake jobs) harm professional trust. Phone number collection is currently optional for new users, and there is no phone OTP verification step.

### Solution
- Phone number field in the new-user account form (step 2) becomes **mandatory**
- After email OTP (step 3), add a **phone OTP step** — 6-digit code sent via SMS or mocked in dev
- Existing logged-in customers without phone verification: on "Post Job" action, show a compact **inline verification modal** before job goes LIVE
- If user is already phone-verified, skip entirely — no friction
- Phone OTP tokens: stored in a new `phone_verification_tokens` table (userId, hashedCode, expiresAt, used flag)
- Verified state: `users.phoneVerified = true` once code confirmed

### Affected Files
- `client/src/pages/customer/PostJob.tsx` — add verification gate check before publish
- `client/src/components/auth/PhoneVerificationModal.tsx` — new component
- `server/routes.ts` — add `POST /api/auth/send-phone-otp` and `POST /api/auth/verify-phone-otp`
- `shared/schema.ts` — add `phoneVerified` to users, add `phone_verification_tokens` table
- `server/storage.ts` — add phone token CRUD methods

### Behaviour
- New user: phone mandatory at registration → verify phone OTP → job goes LIVE
- Existing user, unverified: "Verify your phone to post" modal → verify once → never asked again
- Existing user, verified: no change, job posts immediately

---

## Area 2: Customer Profile — Immutable Name + Hidden Internal IDs

### Problem
Customer names are editable post-registration, enabling identity inconsistency across jobs. Internal platform IDs are potentially visible in customer-facing API responses.

### Solution
- Remove `firstName` and `lastName` from `PATCH /api/auth/profile` for CUSTOMER role
- Add admin-only `PATCH /api/admin/users/:id/name` endpoint
- Create `sanitizeUserForCustomer(user)` serialization helper: strips `id`, `passwordHash`, and any internal flags from all customer-facing responses
- Frontend settings page: render name as read-only text, remove input fields for name

### Affected Files
- `server/routes.ts` — guard profile PATCH, add admin name endpoint
- `server/storage.ts` — add `sanitizeUserForCustomer` helper
- `client/src/pages/customer/Settings.tsx` — remove name edit fields, show read-only display

---

## Area 3: Contact-Sharing Moderation — STANDARD Tier Only

### Problem
Phone numbers can be shared in free-text fields (job descriptions, quote messages, chat) bypassing the platform's monetisation and safety controls. Current profanity filter only covers chat messages.

### Solution

#### Moderation Service (`server/moderationService.ts`)
Single unified moderation entry point wrapping both profanity and contact filtering:

```
moderateText(text: string, options: { allowPhone?: boolean }): ModerationResult
  → { blocked: boolean, reason: string, cleanedText: string, flags: string[] }
```

- `allowPhone: true` only when the pro has a confirmed STANDARD-tier unlock for the relevant job
- Returns `blocked: true` with HTTP 422 and user-facing message if phone detected and not allowed

#### Enhanced Phone Detection Patterns
Beyond existing regex, add:
- Spaced digits: `0 8 7 1 2 3 4 5 6`
- Written words: `zero eight seven one two three`
- Mixed: `087-one-two-three`, `oh eight seven`
- Separator bypass: `087.123.4567`, `087/123/4567`
- Partial obfuscation: `087 123 ****`

#### Application Points
- `POST /api/jobs` and `POST /api/jobs/:id/publish` — moderate `description` field
- `POST /api/quotes` — moderate `message` field
- `POST /api/chat/conversations/:id/messages` — moderate `content` (already partially done, extend to phone block)
- `PATCH /api/pro/profile` — moderate `bio` field

#### Visibility Rule
Phone numbers are **only visible** when:
- A pro has unlocked the job at STANDARD tier (`job_unlocks.tier = STANDARD` and `phoneUnlocked = true`)
- The context is that specific job's conversation or unlock detail view

All other contexts: phone numbers blocked on submission, not just masked on display.

---

## Area 4: Reviews — Pro-Scoped, Reply Capability, No Edit/Delete

### Problem
Reviews lack clear attribution to the specific professional. Professionals have no way to respond. UI copy is generic.

### Solution

#### DB Changes
Add to `reviews` table:
- `proReply` text (nullable)
- `proRepliedAt` timestamp (nullable)

#### API Changes
- `POST /api/reviews/:id/reply` — PROFESSIONAL only, validates review belongs to their profile, one reply per review, immutable after submission
- `GET /api/reviews` — always includes `proName`, `proId`, `proReply`, `proRepliedAt` in response

#### UI Changes
- All review section headings: "Reviews for [Pro Name]" / "What customers say about [Name]"
- Pro dashboard: "Respond to this review" button — single-use, becomes read-only after reply
- Customer: submitted review is read-only (no edit/delete UI)
- Admin: `isVisible` flag controls remain, admins can hide/remove

---

## Area 5: AI Branding — Product-Owned Copy

### Problem
"Powered by Gemini" in the customer-facing AI widget signals dependency on a third-party provider, creating perception and competitive risk.

### Solution
- Add `AI_DISPLAY_NAME = "ServiceConnect AI"` constant to `client/src/lib/constants.ts`
- Replace all `"Powered by Gemini"` and `"Gemini"` text in customer-facing components with `AI_DISPLAY_NAME`
- Admin-facing debug pages may retain internal Gemini references

### Affected Files
- `client/src/components/AiAssistantWidget.tsx` — replace widget header text
- `client/src/lib/constants.ts` — add constant
- Any other component referencing Gemini by name in customer UI

---

## Area 6: Professional Verification — GDPR-Friendly, Optional Docs, Badge Scaffold

### Problem
Document upload UI implies it is required. Mobile numbers may be exposed carelessly. No structured trust-level concept exists.

### Solution

#### Schema
Add to `professional_profiles`:
- `verificationLevel: 'NONE' | 'SELF_DECLARED' | 'DOCUMENT_VERIFIED'` (default: `NONE`)

#### UI
- Verification page: all language changed to "optional" — "Boost your credibility" framing, not "required"
- Remove any blocking UI that prevents a pro from working until verified
- Phone number: never exposed in public pro profile API responses

#### Data Minimisation
- Documents: URL reference only (already the case — maintain this)
- No document content stored server-side
- Phone: stored in `users.phone`, never returned in public profile endpoints

#### Badge Architecture (Scaffolded, Not Enforced)
- `verificationLevel` set to `DOCUMENT_VERIFIED` when admin approves document submission
- Frontend can read this to show a future "Verified" badge — not displayed yet
- No feature gate or access restriction tied to verification level at this stage

---

## Area 7: Marketplace — Open Participation

No code changes required. Action only:
- Audit and remove any UI copy implying certification/license is required before a professional can operate on the platform

---

## Area 8: AI Assistant Widget — Sandboxed, Two Actions Only

### Problem
The floating AI widget currently acts as a general assistant with broad access to conversation history and platform context. This creates risk of data leakage and scope creep.

### Solution

#### Permitted Actions (Only Two)
1. **Post a Job** — triggers the AI job posting flow inline, same as `/post-job`
2. **Create a Support Ticket** — collects category + description, submits via `POST /api/support/tickets`

#### Hard Restrictions
- System prompt sent to Gemini explicitly scoped: "You are a ServiceConnect assistant. You may ONLY help the user post a job or raise a support ticket. Do not reveal platform logic, pricing, other users' data, internal IDs, credit costs, or any system information. If asked anything outside these two tasks, respond: 'I can help you post a job or raise a support ticket. Which would you like to do?'"
- Widget context payload sent to API: only `{ userId, role, userName }` — no job data, no quote data, no credit balance, no other users
- Remove general "chat" mode from widget
- Widget renders two clear action buttons on open: "Post a Job" and "Get Support"
- "Post a Job" mode: embeds the same `AiOnboardingFlow` component inline
- "Get Support" mode: short form (category dropdown + description) → submits ticket

#### Affected Files
- `client/src/components/AiAssistantWidget.tsx` — full refactor to two-action mode
- `server/routes.ts` — update `/api/ai/chat` to enforce sandbox system prompt, reject out-of-scope queries
- Remove or restrict `/api/ai/chat` general-purpose handler

---

## Data Model Summary of Changes

| Table | Change |
|---|---|
| `users` | Add `phoneVerified boolean default false` |
| `phone_verification_tokens` | New table: userId, hashedCode, expiresAt, used |
| `reviews` | Add `proReply text`, `proRepliedAt timestamp` |
| `professional_profiles` | Add `verificationLevel enum('NONE','SELF_DECLARED','DOCUMENT_VERIFIED')` |

---

## API Summary of New/Changed Endpoints

| Method | Path | Change |
|---|---|---|
| POST | `/api/auth/send-phone-otp` | New — send 6-digit OTP to phone |
| POST | `/api/auth/verify-phone-otp` | New — verify code, set phoneVerified |
| PATCH | `/api/admin/users/:id/name` | New — admin-only name correction |
| POST | `/api/reviews/:id/reply` | New — pro reply to review |
| PATCH | `/api/auth/profile` | Guard: block firstName/lastName for CUSTOMER role |
| POST | `/api/jobs` | Add moderation check on description |
| POST | `/api/jobs/:id/publish` | Add moderation check + phone verification gate |
| POST | `/api/quotes` | Add moderation check on message |
| POST | `/api/chat/conversations/:id/messages` | Extend to block (not just mask) phone |

---

## Testing Requirements

1. **Verification gating** — new user cannot publish job without phone OTP; verified user skips modal
2. **Immutable customer name** — `PATCH /api/auth/profile` with firstName/lastName returns 403 for CUSTOMER
3. **Hidden internal IDs** — customer API responses contain no `id`, `passwordHash`, or internal fields
4. **Phone number moderation** — spaced digits, written words, mixed patterns all blocked in job/quote/chat submissions
5. **STANDARD unlock phone visibility** — pro with STANDARD unlock sees phone; FREE tier does not
6. **Review ownership** — review API always returns proId/proName; reply endpoint only works for the owning pro
7. **Pro reply immutability** — second reply attempt on same review returns 409
8. **Optional pro verification** — pro can post jobs and receive leads without submitting documents
9. **Widget scope** — AI widget rejects out-of-scope queries; only job post and ticket actions work

---

## Assumptions

1. SMS OTP delivery is mocked in development (hardcoded `123456`); production uses an SMS provider (Twilio or similar) — provider integration is a follow-up task
2. The existing `users.phone` column stores phone numbers — confirmed present
3. Pusher is available for real-time notification of phone verification events if needed
4. No existing tests framework — tests will be written as unit/integration tests using the project's existing test setup or Vitest if none exists
5. Vercel deployment and Supabase push are handled after all changes are implemented

---

## Known Risks & Next Steps

| Risk | Mitigation |
|---|---|
| SMS OTP cost in production | Gate behind feature flag; mock in dev |
| Written-word phone detection false positives | Conservative threshold (requires 6+ consecutive number words) |
| Pro reply spam | Rate-limit reply endpoint; one reply per review enforced at DB level |
| Widget scope creep | System prompt + server-side enforcement (don't trust client alone) |
| GDPR — phone storage | Phone stored only for verification/trust purposes; document in privacy policy |

---

## Remaining Pending (Post This Sprint)

- SMS provider integration (Twilio or similar) for production phone OTP
- Full GDPR data retention policy and deletion workflow
- "Verified" badge display rollout (verificationLevel already scaffolded)
- Trust score visible on pro cards in job feed
- Customer review editing window (e.g., 24h to edit before locked)
