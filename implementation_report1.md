# ServiceConnect Implementation Report: Role-Aware AI Onboarding

**Date:** 2026-04-08  
**Scope:** Primary public signup refactor into a role-aware AI-guided onboarding system  
**Status:** Implemented in code, typecheck passing, test suite added and passing

---

## What Was Built

The public signup experience was refactored into a single primary onboarding shell at `/register` that adapts immediately based on role:

- `CUSTOMER` onboarding now starts with AI-led job intake, not account creation
- `PROFESSIONAL` onboarding now starts with AI-led profile intake, not job intake
- account creation is blocked until both phone and email verification succeed
- onboarding state is persisted in resumable server-side sessions
- guest `/post-job`, `/register/customer`, and `/pro/onboarding` now funnel into the new primary flow
- the old public self-service registration endpoints for customer/professional signup were deprecated as primary paths to avoid conflicting behaviour

This is not a UI-only layer. The refactor includes backend session persistence, verification logic, role-specific validation, transactional completion, routing, and tests.

---

## How The Role-Based AI Signup Flow Works

### Primary flow entry

The first decision is role:

- `Customer`
- `Professional`

That role controls:

- the conversation prompts
- the fields collected
- the validation rules
- the confirmation screens
- the OTP targets
- the final account creation logic
- the redirect destination

### Backend onboarding session model

A new onboarding session model now stores pre-account state with:

- `role`
- `currentStep`
- `status`
- `payload`
- `transcript`
- `verificationState`
- `expiresAt`
- `completedAt`

The frontend only stores the onboarding session id locally. The actual onboarding data remains server-side so refresh recovery is safe and account creation does not happen prematurely.

### AI-assisted but server-governed

Gemini remains the conversational layer, but the server decides when a step is complete. This prevents the AI conversation from skipping required onboarding stages.

The AI gathers context conversationally. The backend then validates completeness and moves the user through deterministic stages.

---

## Customer Onboarding

### Customer step sequence

1. `JOB_INTAKE`
2. `JOB_REVIEW`
3. `PERSONAL_DETAILS`
4. `PERSONAL_REVIEW`
5. `PHONE_OTP`
6. `EMAIL_OTP`
7. `PASSWORD`
8. `COMPLETE`

### What the system collects first

Before any account is created, the customer flow captures a postable job draft:

- job title
- job description
- service category
- urgency
- location or service context
- any missing clarifications needed to make the job postable

The AI asks natural follow-up questions and the server checks that the job is complete enough to move forward.

### Review and confirmation

Before OTP begins, the customer must confirm:

- job summary
- urgency
- category
- location
- full name
- phone
- email

Edits are supported. If a verified phone or email is changed later, that verification is invalidated and must be redone.

### Completion behaviour

After both OTP checks and password setup:

- the customer account is created
- the user is signed in automatically
- the collected first job is created transactionally
- if final validation still passes, the job is saved as `LIVE`
- if the job still needs manual completion, it is saved as `DRAFT`
- the user is routed to the customer dashboard with the correct first-job continuation state

---

## Professional Onboarding

### Professional step sequence

1. `PROFILE_INTAKE`
2. `PROFILE_REVIEW`
3. `PERSONAL_DETAILS`
4. `PERSONAL_REVIEW`
5. `PHONE_OTP`
6. `EMAIL_OTP`
7. `PASSWORD`
8. `COMPLETE`

### What the system collects first

Professionals do not start with a job. The onboarding captures a functional professional profile:

- trade or service categories
- primary location
- service areas or coverage
- short bio/about summary
- optional business name
- optional years of experience
- optional credentials
- optional service radius

This keeps onboarding broad and adoption-friendly while still making the account usable immediately after signup.

### Review and confirmation

Before OTP begins, the professional must confirm:

- professional profile summary
- service categories
- coverage/location
- optional business/about details
- full name
- phone
- email

### Completion behaviour

After both OTP checks and password setup:

- the professional account is created
- the user is signed in automatically
- the professional profile is created
- starter credit state is initialized
- verification status is set up for future trust-badge expansion
- the user is routed to the professional dashboard
- trust/profile enhancement remains non-blocking

Document upload and certification upload remain optional for now.

---

## Verification Architecture

### Demo OTP behaviour

Real SMS/email OTP delivery is not integrated yet.

The current demo verification code for both phone and email is:

`123456`

This behaviour is centralized in shared verification config and the new verification service. The code is not scattered across the codebase.

### What was implemented

A generic verification challenge flow now supports:

- send
- resend
- verify
- expiry handling
- attempt tracking
- per-channel verification state updates

The same verification service is also used by the remaining legacy logged-in phone verification path so demo OTP behaviour is defined in one place.

---

## Public API Added

The new onboarding flow is backed by these public endpoints:

- `POST /api/onboarding/sessions`
- `GET /api/onboarding/sessions/:id`
- `POST /api/onboarding/sessions/:id/chat`
- `PATCH /api/onboarding/sessions/:id`
- `POST /api/onboarding/sessions/:id/otp/send`
- `POST /api/onboarding/sessions/:id/otp/verify`
- `POST /api/onboarding/sessions/:id/complete`

Shared onboarding contracts were added so frontend and backend use the same role, step, payload, and completion shapes.

---

## Existing Flow Changes

The new role-aware onboarding is now the primary public signup path.

### Routing changes

- `/register` now hosts the main onboarding shell
- `/register/customer` redirects into `/register?role=CUSTOMER`
- `/pro/onboarding` redirects into `/register?role=PROFESSIONAL`
- guest `/post-job` now redirects into `/register?role=CUSTOMER`

### Legacy flow hardening

The previous public direct registration path for customer/professional self-signup no longer acts as the primary path:

- `POST /api/auth/register` now rejects public `CUSTOMER` and `PROFESSIONAL` self-signup with guidance to use `/register`
- the old public onboarding endpoints were deprecated from active use

This prevents unverified account creation from bypassing the new onboarding flow.

---

## Files Added / Updated

### New shared contracts and configuration

- `shared/onboarding.ts`
- `shared/verification.ts`
- `shared/schema.ts`

### New backend onboarding and verification logic

- `server/onboardingService.ts`
- `server/onboardingRoutes.ts`
- `server/verificationService.ts`
- `server/routes.ts`

### New frontend onboarding shell and persistence helpers

- `client/src/components/onboarding/RoleAwareOnboarding.tsx`
- `client/src/components/onboarding/RoleAwareOnboarding.test.tsx`
- `client/src/lib/onboarding.ts`
- `client/src/pages/public/Register.tsx`
- `client/src/pages/public/RegisterCustomer.tsx`
- `client/src/pages/public/ProOnboarding.tsx`
- `client/src/pages/customer/PostJob.tsx`
- `client/src/pages/public/Home.tsx`
- `client/src/pages/public/Login.tsx`
- `client/src/components/auth/PhoneVerificationModal.tsx`
- `client/src/pages/customer/Dashboard.tsx`
- `client/src/contexts/AuthContext.tsx`

### Test and tooling additions

- `server/onboardingRoutes.test.ts`
- `server/verificationService.test.ts`
- `client/src/test/setup.ts`
- `vite.config.ts`
- `package.json`
- `package-lock.json`
- `tsconfig.json`

---

## Tests Added

### Shared coverage

- role-based onboarding selection
- session resume after refresh
- centralized demo OTP verification
- invalid OTP handling
- password gating before completion
- account completion and redirect behaviour

### Customer coverage

- customer AI intake session behaviour
- transition from intake to review
- job-first onboarding behaviour

### Professional coverage

- professional session resume
- password completion and redirect to pro dashboard

Current automated validation status:

- `npm run check` passes
- `npm test` passes

---

## Key Logic Decisions

1. **Pre-account state is session-based, not user-based**  
   Customer and professional onboarding now persist in onboarding sessions until verification is complete. This avoids premature user creation and makes refresh recovery safer.

2. **AI conversation does not control progression**  
   The model helps gather information, but the backend owns progression, validation, and completion rules.

3. **Verification is centralized**  
   Phone and email OTP behaviour uses one shared verification service with one demo code source.

4. **Customer job creation is transactional with account creation**  
   The first customer job is created only after required verification and password setup complete.

5. **Professional onboarding stays broad, not compliance-heavy**  
   Optional profile-strength data is supported without forcing certification uploads or hard trust checks yet.

---

## Assumptions

1. Demo OTP remains acceptable for current development and review environments.
2. Existing authenticated customer posting and professional dashboard flows remain valid after signup.
3. Abandoned onboarding sessions can expire and be resumed only while still active.
4. Future trust-badge and verified-credential systems will build on the current professional verification fields rather than replace the onboarding model.

---

## Pending For Real OTP Integration

The demo system is intentionally structured so a real provider can replace it with minimal rewrite.

Still pending:

- SMS provider integration for phone OTP
- email provider integration for email OTP
- provider-backed delivery tracking
- production rate limiting on OTP send and verify endpoints
- production anti-abuse rules such as IP/device throttling
- provider secrets and environment configuration
- branded OTP templates and copy

The swap should primarily happen inside the centralized verification service rather than throughout the onboarding flow.

---

## Known Limitations

1. OTP delivery is still demo-only and always uses `123456`.
2. Current tests focus on the new onboarding shell and backend route/service behaviour, not full browser e2e coverage.
3. Existing legacy onboarding endpoints are deprecated and blocked as primary signup paths, but some logged-in legacy verification UX still remains where appropriate.
4. Real-world SMS/email resend timing and provider failures are not yet represented because the provider layer is not live.

---

## UI Premium Overhaul (Session 2 — 2026-04-08)

### OTP Input
- 6 individual digit boxes replacing a single text input
- Auto-advance on digit entry; backspace moves focus backwards; arrow keys navigate left/right
- Full clipboard paste support — pastes fills all 6 boxes at once
- `fillDemoOtp()` — tapping the displayed demo code fills all digits instantly
- Demo code displayed prominently in a clickable hint chip

### Password Stage
- 5-segment strength bar: grey (empty) → red (weak) → orange → yellow → green (strong)
- Scoring considers: minimum length, uppercase, digit, and symbol presence
- Confirm password field with real-time match indicator (red cross / green check)
- Show/hide password toggles (eye icon) on both fields
- Submit is blocked until passwords match and minimum strength is met

### Chat UX
- Enter submits; Shift+Enter inserts a newline (standard chat convention)
- 3-dot bouncing typing indicator while waiting for AI response
- User and bot avatar chips on each message bubble

### Progress Sidebar
- Gradient role badge (blue for customer, purple for professional)
- Step tracker with three visual states: completed (emerald + check), active (dark ring), pending (grey)
- Live snapshot panel — populates with collected job or profile details in real time
- Phone/email verified status badges in the snapshot

### Completion Screen
- Animated ping pulse behind success icon
- Auto-redirects after a brief pause to the correct dashboard

### Routing Fix
- `PostJobRoute` wrapper in `App.tsx` detects unauthenticated users on `/post-job` and redirects them to `/register?role=CUSTOMER` so they enter the proper guided flow

### Gemini API Fix
- Removed `genAI = null` from `validateKeyOnStartup` catch block — transient cold-start failures no longer disable AI for the lifetime of the process
- Updated revoked API key to new working key

---

## Section 16: Completed/Closed Job Chat Status (2026-04-10)

**Scope:** Chat/conversation system — visual and logical distinction between active and finished-job conversations across customer, professional, and admin views.

---

### Problem

When a job transitioned to COMPLETED or CLOSED, the related chat conversations continued to appear identical to active ones. There was no visual distinction in the inbox, no status banner in the thread, and no way to know at a glance whether a conversation belonged to an active or finished job.

---

### What Was Changed

#### Backend — `server/routes.ts` (5 transition points)

At every point where a job becomes COMPLETED or CLOSED, all linked conversations are now immediately archived:

| Trigger | Route | Job → Status | Action |
|---|---|---|---|
| Customer deletes job | `DELETE /api/jobs/:id` | → CLOSED | Archive conversations |
| Aftercare SORTED response | `POST /api/jobs/:id/aftercare/respond` | → COMPLETED | Archive conversations |
| Decline boost → close | `POST /api/jobs/:id/aftercare/decline-boost` | → CLOSED | Archive conversations |
| Manual close | `POST /api/jobs/:id/close` | → CLOSED | Archive conversations |
| Booking completed | `POST /api/bookings/:id/complete` | → COMPLETED | Archive conversations |

Archive query: `UPDATE conversations SET status = 'ARCHIVED' WHERE job_id = <jobId>`

Admin `/api/admin/conversations` now also returns `jobStatus` alongside `jobTitle`.

#### Backend — `server/scheduler.ts`

Auto-close (jobs in aftercare 72h+ with no response) now archives conversations inside the same transaction as the CLOSED status update.

#### Frontend — `client/src/pages/customer/Chat.tsx` (complete rewrite)

**Inbox/sidebar:**
- Active conversations appear first; archived/finished appear below a "Past Jobs" section divider
- Finished conversation rows shown at 60% opacity with muted avatar colour
- COMPLETED jobs show a green `COMPLETED` micro-badge next to the job title
- CLOSED jobs show a muted `CLOSED` micro-badge
- Unread count badge suppressed on finished conversations

**Chat header:**
- Green "Completed" badge (with checkmark icon) or grey "Closed" badge (with lock icon) shown inline when the job is in a terminal state
- "Request Call" button hidden for finished conversations (no point requesting a call on a completed job)
- Header background slightly muted for finished conversations

**Status banner (beneath header):**
- Completed jobs: green banner — *"This job has been completed. You can still send follow-up messages."*
- Closed jobs: muted banner — *"This job is closed. The conversation history is preserved for reference."*

**Message input:**
- Stays fully enabled — messaging remains open for follow-up (payment queries, reviews, disputes)
- Placeholder text changes to "Send a follow-up message…" on finished conversations

#### Frontend — `client/src/pages/admin/ChatMonitor.tsx`

- Conversation list rows show "Done" (green) or "Closed" (grey) job status badges
- ARCHIVED conversation rows shown at 70% opacity with muted icon
- Thread panel header shows "Job Completed" or "Job Closed" badge next to the job title

#### Pro chat

`/client/src/pages/pro/Chat.tsx` re-exports the customer Chat component, so all changes apply equally to professionals.

---

### Decision: Messaging stays open after completion

Messaging is kept open on completed and closed conversations — not read-only. Rationale:
- Customers and professionals often need post-job communication (receipts, follow-ups, reviews, dispute resolution)
- Blocking messages after completion would create frustration and push communication off-platform
- The visual status indicators (banner, badge, muted styling) make it obvious the job is done without locking the channel
- Admins can always archive or block a specific conversation if needed

---

### Status Sync

| Event | Job status | Conversation.status | When |
|---|---|---|---|
| Booking completed | COMPLETED | ARCHIVED | Immediate |
| Aftercare SORTED | COMPLETED | ARCHIVED | Immediate |
| Manual close | CLOSED | ARCHIVED | Immediate |
| Job deleted | CLOSED | ARCHIVED | Immediate |
| Decline boost → close | CLOSED | ARCHIVED | Immediate |
| Scheduler auto-close | CLOSED | ARCHIVED | In same transaction |

---

### Files Changed

| File | Change |
|---|---|
| `server/routes.ts` | Archive conversations at 5 COMPLETED/CLOSED transition points; return jobStatus from admin endpoint |
| `server/scheduler.ts` | Import conversations table; archive in auto-close transaction |
| `client/src/pages/customer/Chat.tsx` | Full rewrite — visual distinction, sorting, banners, badges |
| `client/src/pages/admin/ChatMonitor.tsx` | Job status badges in conversation list and thread header |

---

### Test Coverage

| Scenario | Result |
|---|---|
| Active job chat — sidebar | Shows normally, no special treatment |
| Completed job chat — sidebar | Muted, "Past Jobs" section, green COMPLETED badge |
| Closed job chat — sidebar | Muted, "Past Jobs" section, grey CLOSED badge |
| Completed chat — thread header | Green "Completed" badge, no Call button |
| Closed chat — thread header | Grey "Closed" badge, no Call button |
| Completed chat — banner | Green info banner displayed |
| Closed chat — banner | Muted info banner displayed |
| Messaging on finished chat | Stays open, placeholder updated |
| Admin conversation list | Shows job status badge, archived rows muted |
| Admin thread header | Shows Job Completed / Job Closed badge |
| Build | ✓ 2,713 modules, no errors |
| Deploy | ✓ https://codebasefull.vercel.app |

---

### Remaining Limitations

- Conversations already in COMPLETED/CLOSED state before this deploy are not retroactively archived — they will display as active in the UI until the next job status change. A one-time migration query can be run if needed: `UPDATE conversations c SET status = 'ARCHIVED' FROM jobs j WHERE c.job_id = j.id AND j.status IN ('COMPLETED', 'CLOSED') AND c.status = 'ACTIVE'`
- No support-ticket conversations are affected (they use a separate ticketMessages system)

---

## Session 3: Quote Flow, Chat Routing, AI Widget & Page Enhancements

**Date:** 2026-04-09  
**Scope:** End-to-end flow fixes across quote acceptance, professional bookings chat, AI widget trigger, and enhanced Leads/Bookings pages

---

### Problems Fixed

#### 1. Missing `POST /api/conversations` endpoint

**Symptom:** Clicking "Chat" in pro Bookings resulted in an error — the page called `POST /api/conversations` but the endpoint didn't exist (404).

**Fix:** Added endpoint to `server/routes.ts` with three-tier find-or-create logic:
1. If `jobId` provided: find conversation linked to that job where the requesting user is a participant
2. If no job match: find any existing direct conversation between the two users
3. Otherwise: create a new DIRECT conversation with both users as participants

This ensures pro Bookings always finds the correct existing conversation (the one created when the job was unlocked) rather than creating a duplicate.

#### 2. Pro Bookings wrong field names

**Symptom:** Job location and service category not displaying in the booking dialog.

**Fix:** `job.location` → `job.locationText`, `job.serviceCategory` → `job.category?.name` (those fields don't exist on the job object from the API).

#### 3. Bookings API missing `conversationId`

**Symptom:** Chat buttons in customer Bookings had no conversationId to route to.

**Fix:** `/api/bookings` enrichment now looks up the conversation for the booking's jobId and returns `conversationId` on every booking object.

#### 4. AI widget not triggering for registered users

**Symptom:** The "Ready to post your job" extraction prompt never appeared after the first user message.

**Fix:** Changed trigger condition from `userCount >= 2` to `userCount >= 1 && combinedLen >= 30` — triggers after just one substantive message (30+ combined characters).

#### 5. Quote acceptance had no follow-through

**Symptom:** After accepting a quote, the user saw a toast but had no clear path to their new booking.

**Fix:**
- Quote acceptance mutation now also invalidates `/api/bookings` cache so the booking appears immediately
- Added MATCHED banner on JobDetail: shows accepted quote amount, "View Booking" → /bookings, "Open Chat" → /chat?conversationId=...
- Added per-quote action buttons on ACCEPTED quotes: View Booking + Open Chat

---

### Files Changed

| File | Change |
|---|---|
| `server/routes.ts` | Added `POST /api/conversations` (lines ~2905–2960); enriched `/api/bookings` with `conversationId` and `customer.phone` |
| `client/src/components/ai/AiAssistantWidget.tsx` | Extraction trigger: 1 message + 30 chars (was: 2 messages) |
| `client/src/pages/customer/JobDetail.tsx` | MATCHED banner, View Booking + Open Chat buttons on accepted quotes, booking cache invalidation |
| `client/src/pages/customer/Bookings.tsx` | Full rewrite: direct conversationId routing, active/past sections, STATUS_COLORS, job title link |
| `client/src/pages/pro/Bookings.tsx` | Full rewrite: Open Chat uses jobId lookup, fixed field names, eircode display, enhanced dialog |
| `client/src/pages/pro/Leads.tsx` | Full rewrite: STATUS_CONFIG+icon system, chat as direct Link, View Booking on accepted, section headers |

---

### Test Matrix — Session 3

| Scenario | Result |
|---|---|
| Pro clicks Chat in Bookings (conversation exists) | Routes directly to conversation |
| Pro clicks Chat in Bookings (no conversationId) | POST /api/conversations finds by jobId |
| Customer accepts quote | Booking created, MATCHED banner shown with navigation buttons |
| Customer navigates to /bookings after acceptance | Booking visible immediately (cache invalidated) |
| Customer clicks Chat on booking | Routes directly to conversationId from API |
| AI widget — first message (30+ chars) | Extraction draft UI appears |
| AI widget — first message (short) | No draft yet (waits for substance) |
| Pro Bookings dialog — location | Shows locationText correctly |
| Pro Bookings dialog — category | Shows category.name correctly |
| Pro Leads — accepted quote | Shows "View Booking" button + green status badge |
| Pro Leads — pending quote | Shows AlertCircle + amber badge |
| Build | ✓ 2,713 modules, no TypeScript errors |
| Deploy | ✓ https://codebasefull.vercel.app |

---

## Session 4: Comprehensive Customer & Professional Platform Enhancements

**Date:** 2026-04-11  
**Scope:** Holistic product advancement across both customer and professional sides — notifications, dashboards, job feed, bookings, profile, and UI/UX polish

---

### Overview

This session significantly advanced both sides of the platform. Key focus areas:

1. Professional notification system (previously completely missing)
2. Backend notification coverage for all key lifecycle events
3. Customer and professional dashboard intelligence
4. Job Feed urgency filtering
5. Pro profile service category picker
6. Pro Bookings: mark complete workflow
7. UI/UX polish across all pages

---

### A. Backend Notification Coverage

Five missing notification events were added to `server/routes.ts`:

| Event | Recipient | Type | Trigger |
|---|---|---|---|
| Quote rejected by customer | Professional | `QUOTE_REJECTED` | `POST /api/quotes/:id/reject` |
| Booking created (quote accepted) | Professional | `BOOKING_CREATED` | `POST /api/quotes/:id/accept` |
| Booking completed | Both parties (non-caller) | `BOOKING_COMPLETED` | `POST /api/bookings/:id/complete` |
| Booking cancelled | Both parties (non-caller) | `BOOKING_CANCELLED` | `POST /api/bookings/:id/cancel` |
| Review posted | Professional (reviewee) | `REVIEW_POSTED` | `POST /api/bookings/:id/review` |

All use the existing `createNotification(userId, type, title, message, data)` helper which writes to the DB and pushes via Pusher in real time.

The BOOKING_CREATED notification required capturing the booking ID from within the transaction scope (hoisted via `let createdBookingId = ""` before the transaction block).

---

### B. Professional Notification System

Previously professionals had no notification system whatsoever. This session delivers a complete one:

**`client/src/pages/pro/Notifications.tsx`** — Created as a role-aware re-export of the customer Notifications component. The shared component already reads `user.role` and uses `isProRole` to route notification deep links correctly for professionals vs customers.

**`client/src/App.tsx`** — Added `/pro/notifications` route protected by `roles={["PROFESSIONAL"]}`.

**`client/src/components/layouts/DashboardLayout.tsx`** — Added `{ label: "Notifications", href: "/pro/notifications", icon: Bell }` to `ProNav()`. The existing unread badge logic at line 121 triggers automatically for any nav item labeled "Notifications" — no additional change needed.

**`client/src/pages/customer/Notifications.tsx`** — Enriched with:
- New `NOTIFICATION_ICONS` entries: `QUOTE_REJECTED` (XCircle, red), `REVIEW_POSTED` (Star, yellow), `BOOKING_CREATED` (CalendarCheck, emerald), `BOOKING_COMPLETED` (CheckCircle2, emerald), `BOOKING_CANCELLED` (AlertTriangle, red), `AFTERCARE_2D/5D/REMINDER` (Calendar, orange), `JOB_AUTO_CLOSED` (Briefcase, muted), `SYSTEM` (AlertTriangle, orange)
- New deep-link cases in `getNotificationLink()` routing pros to `/pro/bookings`, `/pro/leads`, `/pro/profile` for booking/quote/review events
- Added `BOOKING` filter group covering `BOOKING_CREATED`, `BOOKING_COMPLETED`, `BOOKING_CANCELLED`

---

### C. Pro Profile Service Category Picker

`client/src/pages/pro/ProfileEditor.tsx` — Added a complete category management UI:

- Fetches all categories from `/api/categories`
- Shows each as a toggleable pill button (selected = primary colour, unselected = outline)
- Shows a loading skeleton while categories load
- Saves to `/api/pro/profile` PATCH with `serviceCategories: selectedCategories` array
- Initialises `selectedCategories` from the existing profile on load
- Added bio character counter (0/500 characters)

---

### D. Pro Bookings: Mark Complete Button

`client/src/pages/pro/Bookings.tsx` — Added `markComplete` mutation and an emerald "Mark Complete" button in the booking detail Dialog, visible only when `selectedBooking.status === "IN_PROGRESS"`. Previously professionals could mark bookings as In Progress but had no way to complete them from their own side.

Loading state improved from a basic spinner to three skeleton cards (animated pulse with realistic proportions).

---

### E. Customer Dashboard Enhancements

`client/src/pages/customer/Dashboard.tsx` — Two key improvements:

**Actions Required banner:** Appears between stats and the two-column layout whenever `pendingQuotes.length > 0 || unreadNotifCount > 0`. Shows clickable rows:
- "X quotes waiting for your decision" → `/my-jobs`
- "X unread notifications" → `/notifications`

**Quote count badges on job cards:** Each job in the Job Pipeline now shows a blue "N quotes" badge when `pendingQuotesByJob[job.id] > 0`, computed from the `/api/quotes` response filtered to PENDING status, grouped by jobId.

---

### F. Pro Dashboard Enhancements

`client/src/pages/pro/Dashboard.tsx` — Three key improvements:

**4th stat card changed to "Notifications":** Shows unread notification count with Bell icon and link to `/pro/notifications`. Previously showed "Jobs Done" which is less actionable.

**Actions Required banner:** Shown when `unreadNotifCount > 0 || pendingQuotes.length > 0 || activeBookings.length > 0`. Three rows:
- Unread notifications → `/pro/notifications`
- Quotes awaiting response → `/pro/leads`
- Active bookings in progress → `/pro/bookings`

**Category setup amber banner:** Shown when `!profile?.serviceCategories?.length`. Prompts the pro to complete their profile with a "Set Up Profile" button linking to `/pro/profile`. Disappears once categories are set. Prevents the common confusion of seeing an empty job feed without understanding why.

---

### G. Pro Job Feed: Urgency Filter Pills

`client/src/pages/pro/JobFeed.tsx` — Added a row of urgency filter pills below the "How it works" banner:
- "All urgencies" / "Urgent" / "High" / "Normal" / "Low"
- Client-side filter on `job.urgency` field; URGENT also matches `job.aiIsUrgent === true`
- Active pill uses primary colour with shadow; inactive uses glassmorphism outline style
- Filter resets to "all" when category changes

---

### Files Changed

| File | Change |
|---|---|
| `server/routes.ts` | 5 new `createNotification` calls for QUOTE_REJECTED, BOOKING_CREATED, BOOKING_COMPLETED, BOOKING_CANCELLED, REVIEW_POSTED |
| `client/src/pages/customer/Notifications.tsx` | New icon types, deep-link cases, BOOKING filter group |
| `client/src/pages/pro/Notifications.tsx` | New file — re-exports the role-aware Notifications component |
| `client/src/App.tsx` | Added `/pro/notifications` protected route |
| `client/src/components/layouts/DashboardLayout.tsx` | Added Notifications to ProNav |
| `client/src/pages/pro/ProfileEditor.tsx` | Service category picker + bio counter |
| `client/src/pages/pro/Bookings.tsx` | Mark Complete button + skeleton loader |
| `client/src/pages/customer/Dashboard.tsx` | Actions Required banner + quote count badges on job cards |
| `client/src/pages/pro/Dashboard.tsx` | Notifications stat, Actions Required banner, category setup banner |
| `client/src/pages/pro/JobFeed.tsx` | Urgency filter pills |

---

### Notification System — Role Deep Links

| Notification type | Customer link | Professional link |
|---|---|---|
| `NEW_QUOTE` / `JOB_QUOTE` | `/jobs/:jobId` | — |
| `QUOTE_ACCEPTED` | `/jobs/:jobId` | `/pro/leads` |
| `QUOTE_REJECTED` | — | `/pro/leads` |
| `BOOKING_CREATED` | `/bookings` | `/pro/bookings` |
| `BOOKING_COMPLETED` | `/bookings` | `/pro/bookings` |
| `BOOKING_CANCELLED` | `/bookings` | `/pro/bookings` |
| `REVIEW_POSTED` | `/bookings` | `/pro/profile` |
| `NEW_MESSAGE` | `/chat?conversationId=X` | `/pro/chat?conversationId=X` |
| `JOB_UNLOCK` | `/jobs/:jobId` | `/pro/feed` |

---

### Remaining Limitations

1. No "new relevant job available" push to professionals when a matching job is posted — would require a category-matching fan-out at job publish time
2. No batch notification digests or email delivery — all notifications are in-app only
3. Pro category picker saves categories but the job feed category filter still requires a page refresh to reflect the new profile state
4. OTP delivery remains demo-only (`123456`)

---

### Recommended Next Priorities

1. New job notification fan-out: when a job goes LIVE, notify all professionals whose `serviceCategories` overlap with the job's category
2. Email digest for unread notifications (daily/weekly)
3. Admin notification management UI (send broadcast, view logs)
4. Review reminder nudge 48h after booking completion
5. Pro profile completeness score — show a percentage bar and guide pros through missing fields
6. Customer re-engagement: if a job has been LIVE for 3 days with no quotes, send a prompt to boost or revise
7. Real SMS/email OTP provider integration
