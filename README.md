# ServiceConnect Platform

ServiceConnect is a production-ready, peer-to-peer service marketplace connecting local customers with qualified professionals. Built with a focus on real-time communication, AI-driven job quality control, and a robust credit-based monetization model, it offers a seamless end-to-end experience from job posting to booking completion.

---

## 📋 Features & Capability Inventory

### 👤 Customer Features
- **AI-Suported Job Posting**: Instant feedback on job quality, fake job detection, and auto-urgency tagging powered by Google Gemini.
- **Job Management**: Track job status (Live, Matched, Completed) and view professional responses.
- **Real-time Chat & WebRTC Calling**: Secure communication with professionals without exposing personal phone numbers until explicitly unlocked.
- **Booking & Reviews**: Confirm quotes, manage service dates, and leave ratings/reviews for completed work.
- **Support & Notifications**: Integrated ticketing system and real-time alerts.

### 🛠️ Professional Features
- **Job Discovery Engine**: Browse local leads filtered by category, location, and urgency.
- **Matchbook & Lead Unlocking**: Save interesting leads and unlock contact details using a credit-based system.
- **Quote Management**: Send professional estimates with duration and custom messages.
- **Gamified Daily Rewards**: A "Spin the Wheel" feature offering daily credits, boosts, and badges to encourage retention.
- **Profile Customization**: Portfolio management, service area definition (radius-based), and verified badges.
- **Subscription & Boosts**: Stripe-integrated subscription tiers and lead boosting to increase visibility.

### 🛡️ Admin & Operational Controls
- **Centralized Dashboard**: Real-time metrics on user growth, job volume, and revenue.
- **Chat Monitoring**: Advanced tools for moderation and dispute resolution across all active conversations.
- **Feature Flags**: Dynamic control over platform capabilities without redeployment.
- **Audit Logging**: Comprehensive tracking of administrative actions for security compliance.
- **Support Ticket Management**: Full helpdesk functionality for resolving user issues.

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Access Level | Key Permissions |
| :--- | :--- | :--- |
| **Customer** | User | Post jobs, accept quotes, review pros, initiate chat/calls. |
| **Professional** | User | Browse jobs, unlock leads, send quotes, manage business profile. |
| **Admin** | Superuser | System metrics, user moderation, chat monitoring, audit logs, feature flags. |
| **Support** | Staff | Ticket resolution and basic user management. |

---

## 🔄 Core User Flows

1. **The Lead Lifecycle**:
   - **Customer** posts a job. AI scores quality and tags urgency.
   - **Professional** discovers the lead on their map/list and "Unlocks" it using credits.
   - **Chat** is initiated; both parties can use WebRTC calling once a request is accepted.
   - **Pro** sends a **Quote**; **Customer** accepts to create a **Booking**.

2. **Monetization & Engagement**:
   - **Pros** purchase credit packages or subscriptions via Stripe.
   - **Pros** use credits to unlock leads or boost their profile visibility.
   - **Daily Login** rewards (Spin Wheel) keep professionals engaged.

---

## 💻 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Radix UI, Framer Motion.
- **Backend**: Express.js (Node.js), Passport.js (Local Auth).
- **Database**: PostgreSQL (hosted on Supabase) with Drizzle ORM.
- **Real-time**: Pusher (Signaling for Chat & WebRTC).
- **AI Engine**: Google Gemini API for job analysis and onboarding assistance.
- **Payments**: Stripe API (Subscriptions & Credit Packages).
- **Monitoring**: Recharts (Admin Metrics).

---

## 🏗️ Project Structure

```text
├── client/                 # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/     # Atomic UI and composite modules
│   │   ├── contexts/       # Auth, Socket, and Call providers
│   │   ├── pages/          # Role-split page components (admin, pro, customer)
│   │   └── lib/            # API hooks (TanStack Query) and utils
├── server/                 # Backend (Express)
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API surface (2000+ lines of core logic)
│   ├── auth.ts             # Passport strategies & JWT logic
│   └── aiEngine.ts         # Logic for job scoring & classification
├── shared/                 # Shared TypeScript models
│   └── schema.ts           # Drizzle schema definitions (Source of truth)
└── script/                 # Build and migration automation
```

---

## 🗄️ Database Architecture

The platform uses a relational PostgreSQL schema managed via **Drizzle ORM**.
- **Primary Entities**: `users`, `jobs`, `professional_profiles`.
- **Relationship Links**: `job_matchbooks`, `job_unlocks`, `quotes`, `bookings`.
- **System Entities**: `credit_transactions`, `notifications`, `admin_audit_logs`.

**Commands**:
- `npm run db:push`: Sync schema to the database.
- `npm run db:seed`: Populate the DB with test users and categories.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database (Locally or via Supabase)
- Pusher, Stripe, and Google Gemini API keys.

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root directory (see **Environment Variables** section).
3. Initialize the database:
   ```bash
   npm run db:push
   npm run db:seed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## ☁️ Deployment (Vercel + GitHub)

### Workflow
- **CI/CD**: Pushing to the `main` branch triggers an automatic build and deployment on Vercel.
- **Build Script**: The `script/build.ts` handles the unified build of frontend and backend.

### Required Vercel Config
- Set **Build Command**: `npm run vercel-build`
- Set **Output Directory**: `dist/public` (frontend assets)
- Ensure all production environment variables are mirrored in the Vercel Dashboard.

---

## 🔑 Environment Variables

| Variable | Description | Exposure |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | Server |
| `JWT_SECRET` | Secret for signing auth tokens | Server |
| `GEMINI_API_KEY` | API key for Google AI features | Server |
| `PUSHER_APP_ID/KEY/SECRET` | Pusher credentials for real-time events | Server |
| `VITE_PUSHER_KEY/CLUSTER` | Public Pusher config for the client | Client |
| `STRIPE_SECRET_KEY` | Stripe backend secret (Test Mode) | Server |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe frontend key (Test Mode) | Client |

---

## 🛠️ Operational Guide

### Test Accounts
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@serviceconnect.ie` | `admin123456` |
| **Customer** | `alice@test.com` | `password123` |
| **Professional** | `pro1@test.com` | `password123` |

### Verification Checklist
- [ ] Log in as **Customer**, post a job, and verify AI scoring.
- [ ] Log in as **Pro**, unlock the job, and initiate a chat.
- [ ] Accept a WebRTC call request in the chat window.

---

## ⚠️ Known Issues & Gaps
- **Email/SMS**: Notification templates are implemented, but real SMTP/SMS transport layers need to be wired (currently logged to console).
- **Identity Verification**: Professional identity verification (`is_verified` flag) is currently an administrative manual process.

---

## 📈 Future Improvements
- **Mobile Apps**: Leveraging the established API for React Native or Capacitor mobile wrappings.
- **Review Sentiment**: Using Gemini to summarize professional reviews into a "Pros & Cons" profile summary.
- **Advanced Escrow**: Integrating Stripe Connect for milestone-based payments.
