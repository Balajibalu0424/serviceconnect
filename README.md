# ServiceConnect — Ireland's Smartest Service Marketplace

ServiceConnect is a full-stack platform designed to connect customers with local professionals (plumbers, electricians, cleaners, etc.) using AI-driven matching and real-time communication.

## 🚀 Key Features

### 🤖 AI-Powered Experience
- **AI Job Wizard**: Customers post jobs via an interactive AI chat that categorizes the request and scores its quality.
- **AI Enhancement**: Professionals can use AI to polish their profile bios and responses.
- **Smart Matching**: Automated logic to match jobs with the most relevant pros in the area.

### 📞 Real-Time Communication
- **Live Audio Calls**: Integrated WebRTC calling between customers and pros. **No phone numbers shared** — privacy-first signaling via Pusher.
- **Instant Notifications**: Real-time alerts for new quotes, messages, and job updates.
- **Secure Chat**: Full-featured chat system with quote injection and system messages.

### 💼 Professional Tools
- **Marketplace Dashboard**: Pros see live leads based on their service area and categories.
- **Unlock System**: Pros spend credits to unlock job details and start discussions.
- **Gamification**: Daily "Spin Wheel" for pros to win credits, boosts, and trial upgrades.

### 🛡️ Admin & Support
- **Robust Admin Panel**: Manage users, monitor jobs, and view platform metrics.
- **Support Tickets**: Integrated helpdesk system for dispute resolution and user assistance.
- **Audit Logs**: Full tracking of administrative actions.

---

## 🧠 Deep Dive: AI Intelligence Engine

ServiceConnect uses a sophisticated AI layer powered by **Google Gemini 1.5 Flash** to ensure platform quality and security.

### 1. Job Quality & Trust
- **Quality Scoring**: Every job post is analyzed for detail and intent. Low-quality posts are flagged for improvement.
- **Fraud Detection**: AI detects "fake" or "spam" jobs before they reach professionals.
- **Urgency Detection**: Automatically categorizes jobs as 'Emergency', 'Urgent', or 'Flexible' based on natural language.

### 2. Privacy & PII Masking
- **NER Obfuscation**: Named Entity Recognition (NER) is used to detect and mask phone numbers, emails, and exact addresses in public chats.
- **Secure Unlocking**: Contact details are only revealed after a professional "unlocks" a lead using platform credits.

### 3. Professional Growth
- **Bio Enhancement**: AI helps pros write compelling, professional bios.
- **Smart Quotes**: Suggests personalized quote responses based on the specific job requirements.
- **Review Summaries**: Condensed insights from customer feedback to help pros improve.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Shadcn UI, Framer Motion |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (Supabase/Neon), Drizzle ORM |
| **Real-time** | Pusher Channels (Serverless compatible) |
| **AI Engine** | Google Gemini 1.5 Flash |
| **Auth** | JWT Secure Authentication |
| **Payments** | Stripe (Pre-integrated) |

## 🆔 Project Identifiers

For administrative and deployment tracking:

- **Vercel Project ID**: `prj_cLK7fMreK6Zsh6knWJ4A6xrG6GEk`
- **Vercel Org ID**: `team_NWtacEH7XlimRjg1lPZ0wVAU`
- **Supabase Project ID**: `hukbvdneqqkovrgnoklh` (Region: `eu-west-1`)
- **GitHub Repository**: `balajibrahmacharis-projects/serviceconnect`

---

## 🌍 Environment Variables (`.env`)

To run this project, you need to set up the following environment variables. See `.env.example` for a template.

### Database & Auth
- `DATABASE_URL`: Your PostgreSQL connection string (Supabase or Neon).
- `JWT_SECRET`: A secure 64-character hex string for signing tokens.

### External APIs
- `GEMINI_API_KEY`: Google AI Studio key for the matching engine.
- `STRIPE_SECRET_KEY`: Stripe API key for processing payments.

### Pusher (Real-time & Calling)
- `PUSHER_APP_ID`: Server-side ID.
- `PUSHER_KEY`: Server-side Key.
- `PUSHER_SECRET`: Server-side Secret.
- `PUSHER_CLUSTER`: e.g., `eu`.
- `VITE_PUSHER_KEY`: Client-side key (must match server).
- `VITE_PUSHER_CLUSTER`: Client-side cluster (must match server).

---

## 📦 Deployment Guide (Vercel)

ServiceConnect is optimized for **Vercel** serverless deployment.

### 1. Database Setup
1. Create a PostgreSQL instance on **Supabase** or **Neon**.
2. Run database migrations:
   ```bash
   npm run db:push
   ```
3. (Optional) Seed initial data:
   ```bash
   npm run db:seed
   ```

### 2. Vercel Configuration
1. Import the repository into Vercel.
2. Set the **Build Command**: `npm run vercel-build`.
3. Set the **Output Directory**: `dist/public`.
4. Add all environment variables listed above to the Vercel dashboard.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the development server with `tsx` |
| `npm run build` | Runs the custom build script in `script/build.ts` |
| `npm run vercel-build` | Build command used by Vercel |
| `npm run start` | Starts the production server from `dist/` |
| `npm run db:push` | Syncs Drizzle schema with the database |
| `npm run db:migrate` | Forced sync of Drizzle schema |
| `npm run db:seed` | Fills the database with initial mock data |
| `npm run check` | Runs TypeScript type checking |

---

## 💻 Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Environment**:
   Create a `.env` file based on `.env.example`.
3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5000`.

---

## 📂 Project Structure

- `client/`: React frontend application.
- `server/`: Express backend and API routes.
- `shared/`: Drizzle schema definitions and shared TypeScript types.
- `api/`: Vercel serverless entry point.
- `scripts/`: Database management and utility scripts.

---

## 🛡️ Privacy & Security
- **Data Masking**: PII (phone/email) is automatically masked in chat until a job is officially "unlocked".
- **Encrypted Signaling**: All live call handshakes are encrypted and proxied through the server to ensure user metadata is never exposed directly.

---

Developed with ❤️ for ServiceConnect.
