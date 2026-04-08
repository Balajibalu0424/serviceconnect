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
