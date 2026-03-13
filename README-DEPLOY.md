# ServiceConnect — Deployment Guide
## Vercel (frontend + backend) + Neon (PostgreSQL database)

---

## Overview

| Part | Where it lives |
|---|---|
| Frontend (React/Vite) | Vercel CDN (static files) |
| Backend (Node.js/Express API) | Vercel Serverless Function (`api/index.ts`) |
| Database (PostgreSQL) | Neon managed cloud database |
| Domain | GoDaddy → point DNS to Vercel |

---

## Step 1 — Push your code to GitHub

You must have your project in a GitHub repo. Do this once:

```bash
cd /path/to/serviceconnect

# Initialise git (if not already done)
git init
git add .
git commit -m "Initial commit — ServiceConnect platform"

# Create a new repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/serviceconnect.git
git branch -M main
git push -u origin main
```

> Make sure `.env` is NOT committed. The `.gitignore` already excludes it.

---

## Step 2 — Set up Neon (free PostgreSQL database)

1. Go to **[neon.tech](https://neon.tech)** → click **Sign Up** (free, no credit card needed)
2. Click **New Project**
   - Name: `serviceconnect`
   - Region: **EU West (Ireland)** — closest to your users
3. Once created, go to **Dashboard → Connection Details**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://neondb_owner:AbCdEfGh@ep-cool-name-123.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```
   **Save this** — you'll need it in Steps 3 and 4.

---

## Step 3 — Push your database schema to Neon

Run these commands from your project folder on your local machine:

```bash
cd /path/to/serviceconnect

# Push the Drizzle schema (creates all 26 tables)
DATABASE_URL="your-neon-connection-string-here" npm run db:migrate

# Seed the database with test data (optional but recommended)
DATABASE_URL="your-neon-connection-string-here" npm run db:seed
```

You should see all tables created in the Neon dashboard under **Tables**.

---

## Step 4 — Deploy to Vercel

### 4a — Create a Vercel account
Go to **[vercel.com](https://vercel.com)** → Sign up with GitHub (use the same GitHub account where your repo is).

### 4b — Import your project
1. On the Vercel dashboard, click **Add New → Project**
2. Find your `serviceconnect` repo and click **Import**
3. Vercel will detect it's a Node.js project automatically

### 4c — Configure Build Settings
In the **Configure Project** screen:
- **Framework Preset:** Other
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `dist/public`
- **Install Command:** `npm install`

### 4d — Add Environment Variables
Click **Environment Variables** and add these one by one:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string from Step 2 |
| `JWT_SECRET` | A long random string — generate one below |
| `NODE_ENV` | `production` |
| `STRIPE_SECRET_KEY` | `sk_test_...` (from Stripe dashboard, optional) |

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output and use it as `JWT_SECRET`.

### 4e — Deploy
Click **Deploy**. Vercel will:
1. Install dependencies
2. Build the React frontend → `dist/public/`
3. Build the Express server → serverless function
4. Deploy everything

Your app will be live at: `https://serviceconnect-XXXX.vercel.app`

---

## Step 5 — Connect your GoDaddy domain

If you own `serviceconnect.ie` (or similar) on GoDaddy:

### In Vercel:
1. Go to your project → **Settings → Domains**
2. Click **Add Domain**
3. Type your domain: `serviceconnect.ie`
4. Vercel will show you DNS records to add

### In GoDaddy:
1. Log in to **[GoDaddy → My Products → Domains](https://dcc.godaddy.com/)**
2. Click **DNS** next to your domain
3. Add the records Vercel told you — usually:
   - **Type:** `A` | **Name:** `@` | **Value:** `76.76.21.21`
   - **Type:** `CNAME` | **Name:** `www` | **Value:** `cname.vercel-dns.com`
4. Save. DNS changes take 10–30 minutes to propagate.

Vercel automatically provisions an SSL certificate (HTTPS) once DNS is set up.

---

## Step 6 — Verify it works

Visit your live URL and test:

| Test | Expected |
|---|---|
| Home page loads | ✓ Landing page with categories |
| Login as pro: `pro1@test.com` / `password123` | ✓ Pro dashboard |
| Login as admin: `admin@serviceconnect.ie` / `admin123456` | ✓ Admin panel |
| Post a job as a new customer | ✓ 4-step wizard completes |
| API health check: `https://your-domain/api/categories` | ✓ Returns 16 categories as JSON |

---

## Troubleshooting

### "Function timeout" errors
Vercel serverless functions have a 10-second timeout on the free plan. If you hit this, upgrade to the Pro plan or optimise slow queries.

### Socket.io / real-time chat not working
Vercel serverless functions don't support persistent WebSocket connections. For real-time chat in production, you'll need to either:
- Upgrade to **Vercel Pro** with **Fluid Compute** (supports longer-running functions)
- Or use a dedicated WebSocket service like [Ably](https://ably.com) or [Pusher](https://pusher.com) (both have free tiers)

### Database connection errors
Make sure your `DATABASE_URL` in Vercel environment variables matches exactly what Neon gave you, including `?sslmode=require` at the end.

### Build fails: "Cannot find module"
Run `npm install` locally and make sure `node_modules` is not in your repo.

---

## Local Development (after deployment)

To continue developing locally with the Neon database:

```bash
# Create your local .env file
cp .env.example .env
# Edit .env and set DATABASE_URL to your Neon connection string

# Start the dev server
npm run dev
```

Or keep using a local PostgreSQL for development (faster) and only use Neon in production.

---

## File Summary (what was added for Vercel)

| File | Purpose |
|---|---|
| `vercel.json` | Tells Vercel how to build and route requests |
| `api/index.ts` | Vercel serverless entry point (exports Express app) |
| `.env.example` | Template for environment variables |
| `.gitignore` | Updated to exclude `.env` and `.vercel` |
| `drizzle.config.ts` | Updated to require `DATABASE_URL` in production |
| `package.json` | Added `vercel-build`, `db:migrate`, `db:seed` scripts |
