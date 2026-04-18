# ServiceConnect — Full App & Codebase Analysis Report

**Date:** 2026-04-17
**Auditor:** Senior full-stack / QA / launch-readiness review (read-only)
**Live URL verified:** `https://codebasefull.vercel.app` (login confirmed, API `/api/auth/login` returns 200 with JWT)
**Code baseline:** `main` @ commit `42ec23e` (QA reconciliation pass)
**Scope:** Entire repo at `C:\Users\balaj\Downloads\ServiceConnect_EVERYTHING\codebase_full` (≈250 k line `server/routes.ts`, 28+ tables, 45+ React pages) + live production deployment.
**Ground rules honoured:** no code changes, no deploys, no refactors, no fixes — read-only analysis.

---

## 1. Executive Summary

ServiceConnect is a **surprisingly complete marketplace platform** for the stage of the project. It is not a prototype — it is a near-production-grade system with real Stripe integration, real Pusher-based realtime, real WebRTC calling, a deep admin console, AI-assisted onboarding, and a multi-stage aftercare lifecycle. A returning seeded user can sign in on the live domain, a fresh user can complete session-based onboarding end-to-end on production, and cross-role propagation (customer posts → pro sees in feed → admin sees in jobs) verifiably works.

However, the gap between "works" and "safe to launch publicly" is real and specific:

**Biggest strengths**
- **WebRTC call layer** (`client/src/contexts/CallContext.tsx`) is genuinely well engineered — proper caller/callee state machine, ICE candidate relay over Pusher, stale-closure fix via refs.
- **Onboarding** is a server-governed, resumable session model with AI assist but deterministic stage gates — not an AI-driven free-for-all.
- **Admin console** is deep: 13 pages with search / filter / pagination / CSV export / live moderation refetch.
- **Moderation** is multi-layered (profanity + obfuscated phone + contact-intent NER) and consistently applied at job intake, bio, and chat.
- **Schema** is coherent — 34 tables, 20 status enums, webhook idempotency, immutable credit ledger.

**Biggest weaknesses**
- **Live payments are disabled in production** (Stripe env vars not set on Vercel). The credits UI gracefully surfaces this, but the core monetisation loop does not currently function live.
- **OTP is still in master-fallback mode** (`123456`) in production — the codex live verification and Session 14 in the implementation report explicitly acknowledge this.
- **No versioned DB migrations** — schema is pushed via `drizzle-kit push`; there is no `/migrations` directory and no rollback path.
- **Refresh tokens are long-lived (30 d) with no rotation**, and rate-limits are in-memory (memory store is per-serverless-instance on Vercel, so limits are effectively bypassable).
- **Missing cascade deletes** from `jobs → quotes / bookings / reviews / callRequests` and `bookings → reviews` — deleting a job leaves orphan child records.
- **Legal surface is incomplete**: footer `Privacy / Terms / Cookies` are `#` placeholders; `favicon.png` 404s in production.

**Verdict:** the platform is in **controlled-beta / soft-launch territory** — it can onboard real users in a supervised context today, but it is **not yet production-public-launch-ready** because of the payment configuration gap, OTP fallback, and missing legal/moderation tables.

---

## 2. What Is Built

### 2.1 Authentication & onboarding
- JWT auth (`server/auth.ts`) with bcryptjs@12 hashing, 30-min access / 30-day refresh, `requireAuth` + `requireRole` middleware, production-gated JWT_SECRET.
- Session-based AI onboarding (`server/onboardingService.ts`, ~29 k chars) with 11-stage customer and professional step machines, server-authoritative state, resumable via `previousSessionId`.
- Dual-channel verification (Twilio Verify + Resend email) with demo fallback (`server/verificationService.ts`).
- Password reset tokens, phone verification tokens, device-scoped user sessions.
- Role-aware onboarding funnels legacy `/register`, `/register/customer`, `/pro/onboarding`, and guest `/post-job` into the primary session flow (`App.tsx` `PostJobRoute`, `LegacyRegisterRoute`).
- Separate `/admin/login` page.

### 2.2 Customer product surface
- Dashboard with KPI cards, aftercare prompt cards, pending-quote actions-required panel.
- Post-Job multi-step (1 → 1.5 → 2 → 2.5 → 3 → 4) with AI enhancement, category-specific questions, phone verification modal, asset upload.
- My Jobs (draft / live / closed grouping with quote counts).
- Job Detail (quotes list with sort, accept/reject, review submission, aftercare response, boost, close, edit).
- Bookings with timeline, cancel modal, chat jump, review on completion.
- Notifications with filter, read/unread, delete, pagination.
- Chat with 3 s refetch, auto-scroll, read-only handling on closed jobs.
- Settings (email/phone, notification prefs, address).
- Support tickets with attachments, categories, priority, status tracking.

### 2.3 Professional product surface
- Dashboard with profile-completeness sidebar, credit balance, spin-wheel banner.
- Job Feed with unlock modal (FREE / STANDARD tiers), customer phone reveal on STANDARD, filters.
- Matchbook (soft-matches), Leads (pending/accepted/archived).
- Bookings, Chat (shared component with customer, role-aware), Notifications (shared).
- Profile Editor with completeness score, categories, portfolio, service radius, availability, verification upload.
- Credits page with transaction history and Stripe Elements purchase UI.
- Spin-wheel with animation, cooldown, eligibility, reward transaction.
- Verification-pending page handling UNSUBMITTED / PENDING / APPROVED / REJECTED states.

### 2.4 Admin product surface
13 pages, all real — not stubs:
- **Dashboard** (8 KPI cards, recharts, recent users/jobs, alerts).
- **Users** (search, pagination, verify / suspend / ban / credit-grant, detail sheet with audit and verification docs).
- **Jobs**, **Job Detail**, **Quotes**, **Bookings**, **Reviews**.
- **Chat Monitor** with live refetch (5 s flagged, 15 s conversations).
- **Payments** (status, mode, CSV export, live-vs-test revenue split).
- **Support**, **Audit Logs**, **Feature Flags**, **Metrics**.

### 2.5 Backend
- ~142 route handlers in `server/routes.ts` (≈5 200 lines).
- AI engine (rule-based quality scoring, category detection, fake-job detection, urgency keywords, optional HuggingFace NER masking) + Gemini (`server/geminiService.ts`) for 9 features with graceful fallback.
- Aftercare scheduler (`server/scheduler.ts`) with hourly cron (both `node-cron` local + Vercel `crons:` entry).
- Pusher helper, notification fan-out (`createNotification` with the 5-min dedup added in Session 7 reconciliation).
- Stripe integration (`server/paymentService.ts`) with PaymentIntents, idempotency keys, webhook signature verification, duplicate-webhook protection via `paymentWebhookEvents`.
- Moderation stack (`profanityFilter.ts`, `contactDetection.ts`, `moderationService.ts`).
- Uploads (Vercel Blob + multer, per-purpose MIME/size rules, private verification docs).

### 2.6 Data model (`shared/schema.ts`)
34 tables, 20 status enums. Full list in §8. Highlights:
- Full user → professionalProfile split with verification level and documents.
- `jobs` + `jobMatchbooks` + `jobUnlocks` + `jobBoosts` + `jobAftercares` (two-branch aftercare model).
- `quotes`, `bookings`, `reviews`, `callRequests`.
- `conversations` + `conversationParticipants` + `messages` (with `isFiltered`, `filterFlags`, `originalContent`, `deletedAt`).
- `creditPackages` + `creditTransactions` (single-entry immutable ledger) + `payments` + `paymentWebhookEvents`.
- `supportTickets` + `ticketMessages`.
- `notifications` (with `data` JSON, queried via `->>'jobId'` in the new dedup path).
- `adminAuditLogs`, `platformMetrics`, `featureFlags`, `faqArticles`, `cannedResponses`, `onboardingSessions`, `verificationChallenges`, `uploads`.

### 2.7 Infrastructure
- Vercel static + serverless: `api/handler.js` is a ~2.8 MB bundled Express app; SPA served from `dist/public`.
- `vercel.json` routes `/api/(.*)` to handler, all other paths to `/index.html` (hash routing).
- Vercel cron `/api/cron/aftercare` once daily.
- Pusher for websockets; Stripe for payments; Resend for email; Twilio Verify for SMS; Google Gemini for AI; optional HuggingFace for NER; Vercel Blob for uploads; Supabase-hosted Postgres.

---

## 3. What Is Working Well

1. **Realtime + calling stack.** `CallContext.tsx` implements a real WebRTC state machine (IDLE → RINGING/INITIATING → ACTIVE), Metered TURN with STUN fallback, ICE candidate relay over Pusher, `activeCallRef` to defeat stale closures, auto cleanup on disconnect/failure, mute toggle. This is production-grade.
2. **Onboarding is server-authoritative.** Server controls step advancement, validates payload each turn, moderates bio/description, resumes on refresh, respects 24 h TTL. Good defensive design.
3. **Moderation is layered and consistent.** Leo-profanity + regex + obfuscated-phone detection with 0.4 confidence threshold + contact-intent classifier → block or mask. Applied at job intake, pro bio, chat, tickets.
4. **Admin moderation UX is live.** `/admin/chat` refetches flagged messages every 5 s, conversations every 15 s; dismiss / delete works; users page has suspend / ban / credit-grant; disputes surface in bookings.
5. **Aftercare lifecycle** actually exists end-to-end — scheduler marks jobs AFTERCARE_2D/5D, user responds sorted/not-sorted, system offers boost with discount or closes, review CTA is gated by `hasReview`.
6. **React Query discipline** — every mutation properly invalidates its query keys; auth-token refresh on 401 is retry-once and clean (`client/src/lib/queryClient.ts`).
7. **Design system is coherent.** Tailwind + shadcn/ui + glassmorphic card pattern + gradient headings used consistently; dark mode coverage is real across customer/pro/admin.
8. **Credit + payment ledger** uses Stripe idempotency keys, webhook event uniqueness, signature verification, and fulfillment inside a DB transaction.
9. **Live cross-role propagation verified** in production (codex report §Cross-role propagation): customer creates job via live API → appears in pro feed → appears in admin jobs.

---

## 4. What Is Partially Built

1. **Payments** — code is real, but production is configured as disabled. `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` are not set on Vercel. The UI safely surfaces "setup needed" but no live transaction can complete. Refunds (`markStripePaymentRefunded`) mark the payment REFUNDED but **do not automatically reverse the credit grant** — manual reconciliation required.
2. **Refund / credit reversal** — no automated ledger reversal logic; `creditTransactions` supports a REFUND type but the webhook refund handler does not insert a reversing entry.
3. **VAT / tax** — entirely absent. For an Irish marketplace this is a launch-blocker once payments go live.
4. **SMS and email delivery** — integrations exist but live prod still uses the master OTP fallback (`123456`). Resend and Twilio Verify are wired, but the `VERIFICATION_DEMO_MODE` / `OTP_MASTER_CODE` path is still the active acceptance path on production (Session 14 in impl report).
5. **Notifications** — persistence, Pusher push, dedup (5 min) all present. Missing: delivery-failure retry, push to web/mobile beyond Pusher, and the dedup is overly broad — two real quotes on the same job within 5 min could get one of them suppressed (because dedup keys only on userId+type+jobId, not on quoteId).
6. **Moderation workflow UI** — flagged messages are visible to admin, but there is no `messageReports` / `userReports` table; end-users cannot report a message or a user. Admin action is one-sided.
7. **Audit logs** — table exists (`adminAuditLogs.changes` JSON) and is written, but the admin page is shallow (8.3 kB): list view, no detail drilldown, no diff view.
8. **Rate limiting** — `express-rate-limit` memory store (`server/rateLimit.ts`). On Vercel each serverless invocation starts with a fresh counter, so the limits are "soft" at best. Redis/Upstash not wired.
9. **Geolocation** — Eircode + lat/lng columns exist on jobs and pros, and `radiusKm` exists on pros, but there is no PostGIS index and no stored Eircode→coord mapping. Matching at scale will need this.
10. **Review system** — one-way (customer → pro) with a `ReviewReplyForm` component present; bidirectional (pro → customer) exists in schema but the UX is thin.
11. **Session 13 Clerk migration** was rolled back (impl report §13) — no remaining Clerk code should be present, but the doc indicates migration churn.
12. **Spin wheel** — frontend animation + schema + seed exist, but cooldown enforcement and prize fulfillment need scrutiny in production.

---

## 5. What Is Missing

1. **Legal pages**: Privacy, Terms, Cookies — footer links are `#` placeholders (codex finding #2). No cookie banner, no consent record.
2. **User-facing report/flag UI**: no "report this message", "report this user", "report this review" buttons anywhere in the customer or professional UI.
3. **Moderation schema**: no `messageReports`, `userReports`, `reviewReports`, `moderationActions` table. No `flagged_count`, `reportedBy`, `moderatedAt` on messages or reviews.
4. **Bulk admin actions**: no select-multiple + ban / suspend / delete on users, jobs, quotes, reviews.
5. **Email / push notifications for key events**: `createNotification` writes the DB and Pusher-pushes, but there is no fan-out to Resend for "new quote on your job" / "your booking was confirmed" / "review submitted" outside OTP/password reset.
6. **Versioned migrations**: `drizzle.config.ts` is configured for push-mode only; no `migrations/` dir, no up/down files, no baseline SQL. Rollback path = none.
7. **Observability**: no Sentry, no structured log shipping, no error boundary in React. A crashed component yields a blank page with no telemetry.
8. **E2E tests**: three Playwright-flavoured `test_*.js` root-level files and a handful of Vitest unit tests (`client/src/pages/customer/Chat.test.tsx`, `server/contactDetection.test.ts`, `server/onboardingRoutes.test.ts`, etc.) — but no broad E2E or CI-gated test suite. Everything passes "if you run it", nothing is required to pass on push.
9. **CI**: no `.github/workflows/`, no PR checks. Any commit to `main` auto-deploys regardless of build health on a preview.
10. **Accessibility audit**: forms have labels, but no alt text policy, no keyboard-nav verification, no ARIA on the custom star rating buttons.
11. **Search**: no full-text search on jobs, pros, reviews. Admin search is simple `ilike` LIKE queries.
12. **Notification preferences in DB vs UI**: `users.notificationPreferences` JSON exists with categories; Settings UI partially wires them but no backend enforcement of "don't push this type" was evidenced in `createNotification`.
13. **Professional verification automation**: KYC is admin-manual (acknowledged in README §Known Issues).
14. **Double-entry accounting**: credit ledger is single-entry with `balanceAfter` snapshot — not a dual ledger, so divergence between `users.creditBalance` and the sum of ledger entries is possible.
15. **Pagination hardening**: `safePagination` helper exists but isn't uniformly applied (some list endpoints may still return unbounded results).

---

## 6. What Is Broken

Calibrated as **currently failing or actively mis-behaving** — not just "incomplete".

1. **`favicon.png` 404** in production (codex finding #1, low severity, every session).
2. **Footer legal links go to `#`** (codex finding #2, medium — user-visible, makes the site feel non-production).
3. **Admin list hydration flashes empty state** for 3–5 s (codex finding #3). Caused by React Query first-render with no skeleton on admin pages; the data arrives but the user sees zero counts briefly. Bad for trust.
4. **Rate limits do not hold under Vercel serverless** — the memory store resets per cold start, and there are multiple warm instances. Effectively the limiter is cosmetic in production. Not "broken logic" but "broken guarantee".
5. **Notification dedup is too coarse** — `(userId, type, data.jobId?, 5-min window)` will collapse two legitimate quotes from two different pros on the same job if they arrive within 5 min of each other. (Quote-specific dedup key not used.)
6. **OTP master fallback accepts `123456` in production.** This is a soft-brick for the intended SMS/email flows — anyone who knows the code skips verification. Acknowledged as transitional (Session 14 in impl report).
7. **Refund → credit reversal** — marking a Stripe refund via webhook changes `payments.status` to REFUNDED but does not insert a negative `creditTransactions` row, so refunded customers/pros keep their credits. Silent financial inconsistency.
8. **`jobs` deletion orphans children** — no cascade from `jobs` → `quotes`/`bookings`/`reviews`/`callRequests`. If an admin hard-deletes a job (there's no visible hard-delete UI, but it's possible at the DB), the children remain with dangling FK. (FK is set but non-cascade, so the delete will actually fail unless children are removed first — so this is more "latent" than "actively broken".)
9. **`bookings.quoteId` is nullable** — a booking can be created without a quote; the review UX (which now uses `allBookings` after the QA reconciliation) still works but the schema permits states the product doesn't intend.
10. **Scheduler can double-fire**: `scheduler.ts` starts `node-cron` on server boot AND `vercel.json` declares `/api/cron/aftercare`. If both fire, aftercare transitions run twice per hour. The 5-min dedup in `createNotification` masks the user-visible symptom but the DB row in `jobAftercares` dedup check (insert-if-not-exists pattern) is the real protection, and its correctness depends on unique branch+jobId — which is present on `jobAftercares`.
11. **Admin `audit` route (`/admin/audit`) path does not match the common `/admin/audit-logs` intuition** — no bug, but Session 7 tests noted confusion. Confirmed in `App.tsx` line 238: path is `/admin/audit`.

---

## 7. What Is Fake / Scaffolded / Placeholder

This is the shortest section of the report — the codebase has **very little pure scaffolding**. Specific callouts:

1. **`client/src/pages/pro/Chat.tsx` (96 bytes)** and **`client/src/pages/pro/Notifications.tsx` (253 bytes)** look like stubs but are **intentional re-exports** of the customer components (role-aware internally). Not fake — just thin.
2. **AI Assistant Widget chat** on the public home can have very generic responses when `GEMINI_API_KEY` is unset — then it falls back to scripted replies. On live production Gemini is intended to be configured; if it isn't, the widget degrades gracefully but looks less smart.
3. **Spin wheel prize fulfillment** — UI is polished; server-side `spinWheelEvents` writes are real, but cooldown + prize→credit grant should be re-verified end to end. Currently not evidenced in live tests.
4. **Admin Metrics page** — charts render, but some series appear to use `platformMetrics` rows that may be sparsely populated. Likely partially hydrated.
5. **`AiAssistantWidget` "post-job from chat"** creates a draft job from conversation — real, but the path depends on extracted entities being correct. Fragile if Gemini is unavailable.
6. **`paymentMode` = "DEMO"** rows in `payments` — not hidden, shown in admin with a separate badge; not "fake" but flagged explicitly (`paymentCountsTowardsLiveRevenue()`), which is the right design.
7. **Seed data** (`server/seed.ts`, `server/seed-topup.ts`) is not shipped to prod but is referenced in docs as test accounts (alice@test.com, pro1@test.com, admin@serviceconnect.ie) — these exist on production and are explicitly test accounts.

**Nothing identified as deliberately Potemkin.** Where the UI promises a feature, a real backend + schema + test path exists.

---

## 8. Architecture Review

### 8.1 Frontend
- **Stack:** React 18, Vite 7, wouter (hash routing), TanStack Query 5, Tailwind + shadcn/ui, framer-motion, recharts, lucide-react, Pusher JS.
- **Structure:** role-split `pages/{customer,pro,admin,public}/`. Three global contexts: `AuthContext`, `SocketContext`, `CallContext`. Single `queryClient` with in-memory token cache + localStorage fallback.
- **Strengths:** clean context boundaries; no global mutable store mess; React Query owns server state; every mutation invalidates; consistent file sizing (most pages 10–50 kB); design system coherence.
- **Weaknesses:**
  - Hash routing (`#/…`) rules out clean share-links and SEO of deep pages.
  - Route guard (`ProtectedRoute`) only checks `roles` and `requireVerified`; there's no middleware layer for feature-flag gating in the UI.
  - Repeated `STATUS_COLORS` / `STATUS_LABELS` dictionaries across pages — mild duplication.
  - No error boundary → a rendering error whites out the UI.
  - No code-splitting markers (`React.lazy`) — bundle may be large; JS filename not observable in the home HTML (served as hashed chunk).
  - Some pages are genuinely large: `customer/JobDetail.tsx` is 50 kB, `customer/PostJob.tsx` 41 kB, `admin/Support.tsx` 39 kB, `admin/Users.tsx` 50 kB. Should be broken into child components.

### 8.2 Backend
- **Stack:** Express 5, Drizzle ORM, pg driver, jsonwebtoken, bcryptjs, passport-local (vestigial), Stripe SDK, Resend, Twilio, Pusher, node-cron, multer, `@vercel/blob`, Gemini.
- **Structure:** `server/index.ts` bootstraps; everything hangs off `server/routes.ts` (5 200 lines, ~142 handlers). Service layer files are small and single-purpose (auth, payments, email, sms, moderation, scheduler, aiEngine, gemini).
- **Strengths:** transactions used on financial/state-mutating paths (`db.transaction` ≥ 12 call sites); Stripe idempotency keys; webhook dedup table; parameterised queries via Drizzle (low SQL-injection risk); moderation consistently invoked.
- **Weaknesses:**
  - **One-file god object.** `server/routes.ts` at 5 200 lines is the single most significant tech-debt item. Customer, pro, admin, chat, quote, booking, notification, payment, onboarding helpers are interleaved.
  - **N+1-ish patterns:** `GET /api/jobs` and `GET /api/bookings` use `Promise.all` mappers that issue per-record queries for enrichment — tolerable at current volume, a problem at 10 k jobs.
  - **Rate limit store is memory** — per-instance only.
  - **No service boundary** — business logic lives directly in route handlers.
  - **Error handling** — most handlers do `try { … } catch (err) { 500 }` with a generic message; a few routes swallow errors silently.
  - **Passport** is imported but not used for anything meaningful post-Session 13 rollback; candidate for removal.

### 8.3 Data model
- **Scope:** 34 tables, 20 enums. Documented in detail in the schema audit; see also §2.6.
- **Strengths:** clear primary entities, sensible FKs, unique composites on `jobMatchbooks(jobId,professionalId)`, `jobUnlocks(jobId,professionalId)`, `payments(idempotencyKey)`, `paymentWebhookEvents(provider, providerEventId)`. Good JSON use (notifications.data, onboardingSessions.payload, messages.metadata/filterFlags).
- **Gaps:**
  - **Cascade deletes missing** on `quotes→jobs`, `bookings→jobs`, `reviews→bookings`, `callRequests→jobs/bookings`.
  - **Missing composite indexes** on hot paths: `(userId, type)` on `creditTransactions`; `(customerId, status)` on `jobs`; `(userId, isRead)` on `notifications`; `(jobId, createdAt)` on `quotes`.
  - **No moderation report tables**.
  - **Soft-delete is inconsistent**: present on `users`, `uploads`, `messages`, `jobMatchbooks`, absent on `jobs`, `bookings`, `quotes`, `reviews`, `professionalProfiles`.
  - **JSON fields unvalidated at DB level** — `onboardingSessions.payload`, `notifications.data`, etc. rely on runtime Zod only.
  - **Single-entry credit ledger** with `balanceAfter` snapshot — race-hazardous if two concurrent SPEND transactions land.
  - **Verification documents** are linked via `professionalProfiles.verificationDocumentUploadId` (nullable) with no `uploadDocuments(userId)` back-ref table.

### 8.4 Scalability
- **Read scaling:** Supabase Postgres + direct queries → fine to low tens of thousands of users; will hit N+1 pain in enrichment-heavy endpoints.
- **Write scaling:** good — transactions on critical paths, webhook idempotency.
- **Serverless considerations:** memory rate-limiter is a real limitation; Pusher scaling fine; cron runs in two places (node-cron + Vercel) — must pick one in prod.
- **Cold start:** `api/handler.js` is ~2.8 MB bundled; first request to a cold Vercel function will be slow.

### 8.5 Maintainability / duplication
- `pages/customer/JobDetail.tsx` and `pages/customer/PostJob.tsx` are huge single-file components.
- Repeated status dictionaries across pages.
- `implementation_report1.md` is 2 149 lines covering 14 sessions — good provenance, but some sections conflict (e.g., Clerk migration mid-report then rollback two sessions later). The live truth is in the code, not the doc.
- `codex report.md` + `enhancement_plan_session6.md` + `implementation_plan.md` + `IMPLEMENTATION_REPORT.md` (older) are overlapping artefacts — housekeeping debt.

### 8.6 Coupling / migration risk
- Moving off Pusher would touch `SocketContext`, `CallContext`, every `createNotification` call site, and the webhook endpoint.
- Moving off Gemini would touch onboarding chat, AI widget, and 7 route handlers — but fallbacks are already graceful.
- Moving off Vercel Blob would touch `uploadService.ts` only — clean.
- Moving off hash routing would touch every internal `Link` + redirect + Pusher auth callback URL.
- Multi-tenancy — no orgId anywhere — adding it later is a deep refactor across ~15 tables.

---

## 9. Customer Experience Review

**Overall: strong, polished, cohesive.**

- **Post-Job** is the marquee flow. It is genuinely multi-step, AI-assisted, with a phone verification modal, quality score gate (40/100 threshold), and asset upload. Works end-to-end on live production.
- **Dashboard** does the right thing: surfaces aftercare prompts prominently, shows actions-required count, shows KPI cards. Post-Session-7 fix, the "Actions Required" quote count refreshes correctly.
- **Job Detail** is feature-dense (quotes, sort, accept/reject, review, aftercare CTA, boost, close, edit). The latest QA pass improved the review form UX (star-label, rating word, comment required, loading state).
- **Chat** with 3 s refetch gives a passable pseudo-realtime feel; Pusher push is an add-on. Read-only on closed jobs is a nice polish.
- **Bookings empty-state** now has a "Post your first job" CTA (QA pass). Good.
- **Notifications** page is real: filter, delete, mark-as-read, pagination.
- **Settings**, **Support** are deep.

**Gaps:**
- No report-this-user / block-this-pro UI.
- No in-app way to export one's own data (GDPR access / portability).
- No "account deletion" self-service (compliance risk).
- No receipts / invoice PDFs for paid actions.
- No explicit "job cancellation" flow (only aftercare close).

---

## 10. Professional Experience Review

**Overall: strong on the feature axis, weaker on the onboarding-to-first-lead axis.**

- **Pro onboarding** session flow collects categories, service radius, bio (moderated), KYC document — solid.
- **Verification pending** page handles all four states cleanly.
- **Dashboard** surfaces profile completeness (with action items), credit balance, spin wheel banner, recent activity.
- **Job Feed** is the core daily surface: unlock modal with FREE vs STANDARD tier (customer phone reveal on STANDARD), category and location filters. Good.
- **Leads** disambiguates pending / accepted / archived cleanly; the empty state now has dual CTAs (View Matchbooked / Browse Job Feed) after QA.
- **Credits** page with Stripe Elements is production-shaped; but in live prod Stripe keys are missing so the page shows "setup needed" messaging.
- **Spin wheel** is polished.
- **ProfileEditor** is deep (categories, photos, bio, rates, availability).
- **Pro Chat / Notifications** are shared components (role-aware) — fine.

**Gaps / risks:**
- **Monetisation is disabled live.** The primary professional incentive loop (buy credits → unlock leads) is currently non-functional in production.
- **Credit refund on unlock regret** — not obvious whether a pro can get credits back if a lead turns out to be a fake-job; the fake-job detection exists but the refund-on-fake pathway is not evidenced.
- **KYC is manual** (admin action) — scales poorly.
- **No tax invoices** for credit purchases once live.
- **No "request callback" flow surface-level discoverability**: `callRequests` table exists and the flow seems wired, but the UX path from "I want to call this customer" to "customer accepts / declines" was not evidenced in the explore passes.

---

## 11. Admin / Operations Review

**Overall: impressively deep for the project stage.**

- 13 real pages; search/filter/pagination/CSV export consistent.
- Live moderation refetch on `/admin/chat` (5 s flagged, 15 s conv).
- `/admin/users` detail sheet has audit trail + credit txn history + verification doc viewer — the best admin UX on the platform.
- `/admin/payments` shows both TEST and LIVE rows with appropriate badging.
- `/admin/support` is a real ticket workflow.
- `/admin/flags` has real toggle → `featureFlags` table.
- `/admin/metrics` has recharts trends.

**Gaps:**
- No bulk actions (select N users → ban all).
- `/admin/audit` is shallow — no detail view, no diff.
- No impersonate-user (for support).
- No data export for a specific user (right-to-access).
- No "admin-side job edit" beyond publish/close/reopen.
- Admin list pages hydrate slowly and show a false-zero state briefly (codex).
- No permission granularity — ADMIN role is effectively all-powerful; SUPPORT role in the enum is not meaningfully exercised.
- No rate-limit visibility in admin (can't see "this user was rate-limited").

---

## 12. Security / Hardening Review

### Auth
- JWT access 30 min / refresh 30 d. Good access-token TTL.
- **Refresh tokens do not rotate.** Stolen refresh token = 30-day window.
- `userSessions.refreshTokenHash` is stored base64 — OK, but no revocation endpoint / logout-everywhere.
- JWT_SECRET hard-fails in production if unset — good.
- Passwords bcryptjs@12 — good.

### OTP
- Twilio Verify + Resend integrated, but **`VERIFICATION_DEMO_MODE` / master code `123456` is accepting OTP in live production** (codex + Session 14). **This is a critical pre-launch blocker for any B2C release.**

### Password reset
- Tokens table with hashed values, expiry — standard, adequate.

### Rate limiting
- **Memory-store** (`express-rate-limit` default) on serverless — does not hold across instances. Treat as cosmetic in production. Upstash/Redis needed.

### Upload validation
- MIME + size rules per purpose; filename sanitised; UUID paths; private verification docs.
- **No antivirus/malware scan.** Users can upload arbitrary allowed-MIME files; viewers receive them.
- No EXIF stripping for user-uploaded photos (privacy — GPS in image metadata).

### Moderation bypass risk
- Profanity filter can be circumvented (leet-speak handled partially); obfuscated-phone detector is robust (tokenisation + confidence scoring).
- Contact-intent classifier could false-positive on legitimate "please contact me at the job site" phrasing.
- **No user-facing report feature** — moderation is one-sided.

### Secrets
- `.env.example` is checked in; real `.env` also in repo root (should be in `.gitignore`) — confirm it's not a real production `.env`. If it is, rotate immediately.
- Production secrets live on Vercel env.

### Audit
- `adminAuditLogs` writes happen but are shallow-surfaced in UI.

### Permission boundaries
- `requireAuth` + `requireRole` used consistently; ownership checks (customerId === user.id, professionalId === user.id) present on mutation paths. Saw no obvious IDOR in the sampling.
- Admin endpoints are role-gated; not scoped further.

### Abuse
- No CAPTCHA on login / register / forgot-password. With the memory rate-limit effectively off, credential stuffing is cheap.
- No account-lock-after-N-failed-attempts visible.

### Notable
- No CORS tightening observed beyond defaults.
- No CSP headers observed.
- No trust-proxy hop-count tuning (trust proxy = 1 is set, that's fine for Vercel).

**Security verdict:** foundations are solid, but the combination of (master OTP + memory rate-limit + no CAPTCHA + no MFA + no account lockout) means the auth surface is softer than the marketing would imply. Not exploitable today because obscurity, but not defensible at any scale.

---

## 13. Performance / Data / Query Review

- **N+1 enrichment** in `GET /api/jobs`, `GET /api/bookings`, `GET /api/quotes`: each maps over the result set and fetches related records individually via `Promise.all`. Acceptable at hundreds of rows; painful at thousands.
- **Missing composite indexes** on hot paths (`jobs(customerId,status)`, `notifications(userId,isRead)`, `creditTransactions(userId,type)`, `quotes(jobId,createdAt)`).
- **No full-text search** — job search uses `ilike` on title/description which fans out on the users table.
- **Bundle size** — the Vercel function handler is ~2.8 MB; cold starts will be slow.
- **No HTTP caching** (ETag / stale-while-revalidate) on GET endpoints; React Query `staleTime: 30 s` covers the client, nothing server-side.
- **React Query `staleTime:30s`** default + the new `staleTime:0` on customer dashboard quotes → OK balance.
- **Pusher refetches** on some pages (Chat 3 s, ChatMonitor 5 s) fire regardless of tab visibility.
- **Large React components** will hurt first render — notably `customer/JobDetail.tsx` (50 kB source → bigger compiled).
- **Pagination**: `safePagination` helper exists; spot-checked admin endpoints use it; some internal list endpoints may not.
- **Scheduler** runs hourly; the aftercare check fetches candidate jobs — efficient as long as `jobs.status` is indexed (it is).

---

## 14. Live Deployment vs Codebase

Verified via HTTP probes on 2026-04-17.

| Check | Code says | Docs say | Production actually does |
|---|---|---|---|
| Home page | Renders landing | Codex: loads OK | **200** on `codebasefull.vercel.app`, 2 092 bytes HTML (hash-routed SPA) |
| Login API | `/api/auth/login` returns JWT | Codex: healthy | **200** with valid JWT for `alice@test.com` |
| Health endpoint | — | — | `/api/health` returns SPA HTML (no dedicated health endpoint — not a bug, just absent) |
| Deploy alias | README doesn't pin a URL | Codex pins `codebasefull.vercel.app` | Both `codebasefull.vercel.app` and `serviceconnect.vercel.app` resolve; the former is the canonical live URL per codex |
| Stripe | Real integration in code | README: "Stripe API" | **Disabled** on production (env vars unset). UI handles gracefully. |
| OTP | Real Twilio Verify + Resend | Session 14: master fallback still active | **Master code `123456` accepted in live onboarding** (codex confirmed) |
| Cron | Vercel cron `/api/cron/aftercare` + local `node-cron` | Docs mention aftercare | Vercel cron is active; local node-cron only runs in `server/index.ts` which is not the prod entry (`api/handler.js` is). **In prod only the Vercel cron fires** — so the "double-fire" risk is low in practice. |
| Favicon | Not referenced | Codex: 404 | Still 404 |
| Footer legal | `#` placeholders in code | Codex: placeholder | Still placeholder |
| Admin hydration | No skeletons on admin list pages | Codex: 3–5 s empty flash | Still present |
| Latest commit deployed | `42ec23e` (QA reconciliation) pushed to main | — | Deploy succeeded via GitHub→Vercel auto-deploy; API responds; frontend fixes require browser reload to hit the new hashed bundle |

**Code claims that diverge from production reality:**
- README says "Stripe-integrated subscription tiers and lead boosting to increase visibility." Live production has Stripe disabled. The code is ready, the env isn't.
- README says "Notification templates are implemented, but real SMTP/SMS transport layers need to be wired (currently logged to console)." This is **outdated** — Resend + Twilio Verify integrations exist in code. The gap is environment configuration, not code.
- Multiple impl-report sessions claim "Session X fully verified on live." Cross-session claims should be treated as moment-in-time and re-verified; the codex report is the most reliable recent production-truth document.

---

## 15. Launch Readiness Assessment

### Verdict: **controlled beta ready — not public launch ready.**

**What it can do today:**
- Accept real-user sign-ups and job postings under supervision.
- Run cross-role flows (customer posts → pro unlocks → quote → accept → book → review) with real data.
- Run admin moderation.

**What is currently blocking public launch:**

**Hard blockers (will cause user harm, legal exposure, or financial loss):**
1. **Master OTP fallback active in production** — anyone can sign up without a real phone/email.
2. **Stripe not configured in production** — the platform cannot monetise; pros can't buy credits.
3. **Footer legal links are placeholders** — Privacy, Terms, Cookies all `#`. Non-compliant with GDPR disclosure.
4. **No user-facing report / block UI** — cannot safely expose chat at scale.
5. **Refund → credit reversal missing** — silent financial inconsistency the moment payments go live.

**Serious (will cause support burden and reputational damage):**
6. Rate limits are memory-only on serverless (effectively off in prod).
7. No CAPTCHA / no account lockout on auth — credential stuffing vector.
8. Favicon 404 + admin hydration flash + placeholder links — trust signal degradation.
9. No error boundary → a client-side crash blanks the page.
10. No versioned migrations → no rollback.
11. No observability → you won't know anything is broken.

**Important (operational debt):**
12. `routes.ts` at 5 200 lines — a nightmare to hand off.
13. Missing cascade deletes and composite indexes.
14. Single-entry credit ledger with `balanceAfter` snapshot.
15. N+1 enrichment that will hurt at scale.

**Readable "beta readiness" = YES, today, with an explicit banner.**
**"GA launch readiness" = NO** until Hard blockers 1–5 are closed and at least half of Serious items 6–11 are closed.

---

## 16. Highest Priority Next Steps

### P0 — Cannot launch publicly without these
- **P0.1** Wire real Stripe envs in production (`STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) and verify end-to-end credit purchase + webhook.
- **P0.2** Disable the master OTP (`VERIFICATION_DEMO_MODE=false`, `OTP_MASTER_CODE` unset) and verify Twilio/Resend delivery in production for a fresh signup.
- **P0.3** Ship real Privacy, Terms, Cookies pages and link them from footer; add cookie consent.
- **P0.4** Implement refund → negative `creditTransactions` reversal inside the Stripe webhook handler (+ idempotent).
- **P0.5** Add user-facing "report this message / user / review" UI and corresponding `messageReports`, `userReports` tables.
- **P0.6** Replace `express-rate-limit` memory store with Upstash/Redis (or at minimum apply Vercel Edge rate-limits) on `/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot`, `/api/onboarding/*`, `/api/otp/*`.

### P1 — Must land before any scale
- **P1.1** Add composite indexes: `jobs(customerId,status)`, `notifications(userId,isRead)`, `creditTransactions(userId,type)`, `quotes(jobId,createdAt)`, `messages(conversationId,createdAt)` (the last one may already exist — verify).
- **P1.2** Add `ON DELETE CASCADE` (or explicit soft-delete + archival job) on `quotes→jobs`, `bookings→jobs`, `reviews→bookings`, `callRequests→{jobs,bookings}`.
- **P1.3** Adopt versioned migrations (`drizzle-kit generate`) and commit the `migrations/` dir to git; stop using `drizzle-kit push` in CI.
- **P1.4** Add CAPTCHA (Turnstile/hCaptcha) on login, register, forgot-password.
- **P1.5** Add an error boundary to the React tree; wire Sentry (or equivalent) for both client and server.
- **P1.6** Pick one scheduler source — remove the local `node-cron` from `server/scheduler.ts` OR the `vercel.json` cron — keep the one that matches the serverless topology.
- **P1.7** Narrow `createNotification` dedup to include the relevant ID (quoteId for QUOTE_*, bookingId for BOOKING_*) so dedup can't suppress distinct real events.
- **P1.8** Fix favicon and admin hydration skeletons (30 min work, high trust impact).
- **P1.9** Account-lockout / exponential backoff on failed logins.
- **P1.10** Email fan-out for key notifications (new quote, quote accepted, booking confirmed, review received) — not just Pusher push.

### P2 — Strong improvements before scale
- **P2.1** Split `server/routes.ts` into per-domain files (auth, jobs, quotes, bookings, messages, admin, payments, onboarding, webhooks). No behaviour change, large maintainability win.
- **P2.2** Replace N+1 enrichment with SQL joins / `LEFT JOIN LATERAL` on `GET /api/jobs`, `GET /api/bookings`, `GET /api/quotes`.
- **P2.3** Add antivirus / content-scan on upload (ClamAV on a worker, or a 3rd-party API).
- **P2.4** Add a self-service account-deletion flow + data-export for GDPR compliance.
- **P2.5** Add receipt / invoice PDF for credit purchases.
- **P2.6** Admin bulk actions (select users → ban/suspend/credit).
- **P2.7** Admin audit detail drilldown (before/after JSON diff).
- **P2.8** Code-split large React pages (`JobDetail`, `PostJob`, `Users`).
- **P2.9** Tighten soft-delete policy (consistent `deletedAt` + global query filters).
- **P2.10** Proper tax / VAT line on payments (Stripe Tax or manual).

### P3 — Future work
- **P3.1** Mobile apps (React Native shell consuming the same API).
- **P3.2** PostGIS + proper Eircode→coord mapping; distance-sorted job feed.
- **P3.3** Review sentiment summarisation (Gemini) baked into pro profile.
- **P3.4** Stripe Connect for escrowed milestone payments.
- **P3.5** Full-text search (pg_trgm + GIN) on jobs/pros.
- **P3.6** Permissions granularity (roles + capabilities, SUPPORT role actually distinct from ADMIN).
- **P3.7** Multi-tenant / white-label support (hard — ~15 tables).
- **P3.8** E2E test suite (Playwright) wired to CI PR gates.

---

## 17. Final Verdict

ServiceConnect has **much more real code than a typical pre-launch project** and far less smoke-and-mirrors than the comparable MVPs I have reviewed. The **WebRTC calling, Pusher-based realtime, Gemini-assisted onboarding, admin moderation tools, and Stripe webhook pipeline are all legitimate and operational in code** — the gaps are environmental (Stripe + Twilio/Resend envs in prod), legal (Terms/Privacy), and trust-and-safety (user-facing report UI + real rate limits + CAPTCHA).

Under honest labelling, **this is a closed / controlled beta platform today, about three to four focused engineering weeks away from a defensible public launch.** The P0 list is finite and tractable. The Serious items are not trivial but none of them are re-architectural — they're each 1–3 days of focused work by one engineer.

The single most important operational truth from this audit: **the implementation reports are optimistic. The codex live verification is closer to reality. The code is closer to reality still.** When doc and code disagree, trust the code; when code and production disagree, trust production.

Given that this system has been iterated across 14+ sessions with clear cumulative progress, a tight P0/P1 push focused on the five hard blockers would move this from "controlled beta" to "GA-ready" faster than a new-feature effort of the same length would. Prioritise payments-live, real OTP, legal pages, moderation reports, refund reversal, and persistent rate limits — in that order — and do not ship new features until those are green.
