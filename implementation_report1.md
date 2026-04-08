# ServiceConnect — Implementation Report: Platform Refinement Pass

**Date:** 2026-04-08
**Scope:** Trust, safety, UX clarity, marketplace integrity, and future scalability
**Live:** https://codebasefull.vercel.app

---

## What Was Built / Changed

### 1. Customer Posting Flow — Refactored
**Files:** `client/src/pages/customer/PostJob.tsx`, `server/routes.ts`

- **Streamlined Step 2:** Replaced the verbose account/review step with a compact layout:
  - Compact job summary card (title, category, location, AI quality score)
  - Inline 4-option urgency selector (No rush / Normal / Soon / ASAP) with visual emoji indicators
  - Urgency appears immediately after AI chat, reducing friction
- **Phone mandatory for new customers:** Changed from "Phone (Optional)" to required field with red asterisk, clear explanation ("Required to verify your identity. We'll never share it with pros."), and robust validation (strips formatting, enforces ≥7 digits)
- **Server-side phone enforcement:** Added phone length validation to `POST /api/onboarding/customer` — rejects new customers without valid phone number
- **Verification gating preserved:** Logged-in users still hit phone verification modal if unverified; new users go through email OTP flow after account creation

### 2. Customer Profile Restrictions — Hardened
**Files:** `client/src/pages/customer/Settings.tsx`, `server/routes.ts`

- **Hidden internal IDs:** Removed "Account ID" row from Settings page, replaced "System Info" card with "Account" card showing only account type and member-since date
- **Immutable customer name:** Enforced server-side (`PATCH /api/auth/profile` returns 403 if customer sends firstName/lastName). UI shows read-only name fields for customers with explanation text
- **Admin override:** In place via `PATCH /api/admin/users/:id/name` (admin-only)
- **API response sanitization:** `GET /api/auth/me` strips `id` field from customer responses

### 3. Contact-Sharing Moderation — Extended
**Files:** `server/moderationService.ts`, `server/profanityFilter.ts`

Enhanced detection patterns:
- **New extended phone patterns:** digit-word-digit sequences, numbers disguised with dots/commas/underscores, "call me on" / "text me" + digits, "my number is" patterns
- **Contact intent detection:** NEW pattern category catching "reach me at", "my insta is", "add me on", "find me on" — blocks attempts to invite off-platform contact even without explicit numbers
- **Improved error messages:** All user-facing messages reference "ServiceConnect" by name and explain the safety rationale

**Endpoints now moderated:**
| Endpoint | Field(s) Moderated | Status |
|---|---|---|
| `POST /api/jobs` | title, description | ✅ Pre-existing |
| `POST /api/quotes` | message | ✅ Pre-existing |
| `POST /api/chat/.../messages` | content | ✅ Pre-existing + NER layer |
| `POST /api/bookings/:id/review` | title, comment | ✅ **NEW** |
| `POST /api/reviews/:id/reply` | reply | ✅ Pre-existing |
| `POST /api/support/tickets` | subject, description | ✅ **NEW** |
| `POST /api/support/tickets/:id/messages` | message (customer only) | ✅ **NEW** |
| `POST /api/onboarding/customer` | title, description | ✅ **NEW** |

### 4. Reviews Model Correction
**Files:** `server/routes.ts`, `client/src/pages/customer/JobDetail.tsx`, `client/src/pages/public/Home.tsx`

- **Review always targets professional:** Changed `POST /api/bookings/:id/review` to always set `revieweeId = booking.professionalId` (previously could target either party)
- **Duplicate prevention:** Added check for existing review on same booking by same reviewer — returns 409 if duplicate
- **UI copy updated:**
  - "Leave a review" → "Review this professional"
  - Added subtitle: "Your review will appear on their profile and help other customers"
  - Review card header: "How was your experience with this professional?"
- **Public profile reviews:** ProProfile.tsx already correctly shows "What customers say about {firstName}" — well-attributed
- **Homepage testimonials section:** Changed "What Our Users Say" → "What Customers & Pros Say" with subtitle: "Every review is tied to a real booking between a customer and their professional"
- **Nav link:** "Reviews" → "Testimonials" to avoid confusion with professional-specific reviews

### 5. AI Branding Review
**Files:** `client/src/pages/public/Home.tsx`, `client/src/lib/constants.ts`

- **Removed** "Powered by Google Gemini AI" badge from homepage AI feature section
- **Replaced with** "Built-in AI Intelligence" — product-owned wording
- **Marketing copy changed:** "ServiceConnect uses cutting-edge AI" → "ServiceConnect's AI enhances every step" (no third-party attribution)
- **constants.ts:** `AI_DISPLAY_NAME = "ServiceConnect AI"` — used in chat widget header (no Gemini reference)
- **AI assistant widget:** Uses `AI_DISPLAY_NAME` constant; no Gemini reference visible
- **Footer:** Clean — no AI provider attribution

### 6. Professional Verification / GDPR Handling
**Files:** `server/routes.ts`, `client/src/pages/pro/VerificationPending.tsx`

- **Documents remain optional:** Verification page has "Optional" badge and "Skip for now" button
- **Phone restricted from public profiles:** Fixed `GET /api/pro/:id/profile` to strip phone, email, passwordHash, and internal ID from public response
- **Verification documents hidden from public:** Stripped `verificationDocumentUrl` and `verificationReviewNote` from public profile API response
- **Review enrichment:** Public profile reviews now include `reviewerFirstName` for attribution
- **GDPR minimization:** Verification docs are URL-based (external storage), not stored as blobs

### 7. Marketplace Strategy Alignment

- **No mandatory licensing:** Verification remains optional throughout. "Skip for now" path is prominent
- **Future badge readiness:** Schema has `verificationLevel` enum (NONE / SELF_DECLARED / DOCUMENT_VERIFIED) and `earnedBadges` JSON array — ready for trust badge layers
- **Onboarding stays broad:** No new friction added to professional onboarding

---

## Files Changed

| File | Changes |
|---|---|
| `server/moderationService.ts` | Extended phone patterns, contact intent detection, improved error messages |
| `server/routes.ts` | Review moderation, onboarding phone enforcement, support ticket moderation, public profile phone stripping, duplicate review prevention |
| `client/src/pages/customer/PostJob.tsx` | Urgency selector, mandatory phone, streamlined step 2, Phone icon import |
| `client/src/pages/customer/Settings.tsx` | Hidden Account ID, replaced with member-since date |
| `client/src/pages/customer/JobDetail.tsx` | Review UI copy update — professional-specific wording |
| `client/src/pages/public/Home.tsx` | Removed Gemini branding, testimonials copy fix, nav link fix |
| `implementation_report1.md` | This document |

---

## Key Architectural Decisions

1. **Moderation as blocking, not warning:** All moderation results with `blocked: true` reject the submission with a clear error. Safest default for a marketplace.

2. **Contact intent detection as a separate layer:** Added on top of regex phone detection to catch creative bypass attempts like "my insta is..." even when no phone number is present.

3. **Phone stripping at API level, not UI level:** Public pro profile endpoint explicitly constructs a safe response object. Even if new frontend pages are added, the API won't leak phone numbers.

4. **Reviews always target professionals:** `revieweeId` is now always `booking.professionalId`. Matches the marketplace model where customers review the service received.

5. **Urgency as inline selection, not a separate step:** Embedded in the review/account step as a visual 4-option grid. Keeps the flow compact while making urgency selection impossible to skip.

---

## Assumptions

1. **Phone verification = primary anti-ghost-lead gate:** Enforced before job posting for both new and existing customers
2. **Staff skip moderation on internal notes:** Support staff messages marked as internal bypass moderation
3. **Testimonials ≠ reviews:** Homepage testimonials are static marketing. Actual reviews are per-professional
4. **Document storage is URL-based:** External hosting (Google Drive, etc.), minimizing GDPR retention burden

---

## Known Limitations

1. **Phone verification uses dev mock code (123456):** Real SMS delivery requires Twilio/MessageBird integration
2. **Email OTP also uses mock code:** Requires SendGrid/Resend integration for production
3. **Contact intent detection may have edge cases:** Regex-based. HuggingFace NER in chat provides additional coverage
4. **No automated test suite:** Codebase lacks test framework. Tests recommended as next step

---

## Recommended Next Steps

1. **Integrate SMS provider (Twilio/MessageBird)** for real phone OTP — #1 production blocker
2. **Integrate email provider (SendGrid/Resend)** for real email verification
3. **Add automated test coverage:** Moderation patterns, review creation, posting flow
4. **Rate limiting on OTP endpoints** to prevent brute-force
5. **Professional badge system:** Visual badges on job feed based on `verificationLevel`
6. **Document retention policy:** Scheduled cleanup of old verification URLs and expired tokens
7. **Content moderation dashboard:** Track moderation blocks in admin analytics
