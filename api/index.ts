/**
 * Vercel Serverless Entry Point
 *
 * Vercel runs this as a serverless function — we export a handler function.
 * Routes are registered once via a module-level promise (lazy init pattern)
 * so they're ready before the first request is served.
 *
 * Socket.io is NOT used here — it requires a persistent server which is
 * incompatible with Vercel serverless. Real-time features degrade gracefully.
 *
 * node-cron (aftercare scheduler) is also NOT started here — Vercel functions
 * are stateless and short-lived. The scheduler must be run separately
 * (e.g., a Vercel Cron Job or a separate always-on server).
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      console.log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// ── Lazy-init pattern ──────────────────────────────────────────────────────
// Routes are registered once. The promise is reused on subsequent invocations
// so we never register routes twice, and the handler always waits until ready.
let routesRegistered: Promise<void> | null = null;

function ensureRoutes(): Promise<void> {
  if (!routesRegistered) {
    const httpServer = createServer(app);
    routesRegistered = registerRoutes(httpServer, app)
      .then(() => {
        // Global error handler — must be added AFTER routes
        app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
          const status = err.status || err.statusCode || 500;
          const message = err.message || "Internal Server Error";
          console.error("Unhandled error:", err);
          if (!res.headersSent) {
            res.status(status).json({ message });
          }
        });
      })
      .catch((err) => {
        // Reset so the next invocation retries
        routesRegistered = null;
        throw err;
      });
  }
  return routesRegistered;
}

// ── Vercel handler export ──────────────────────────────────────────────────
// Vercel calls this function for every /api/* request.
// We await route registration before letting Express handle the request.
export default async function handler(req: Request, res: Response) {
  try {
    await ensureRoutes();
  } catch (err: any) {
    console.error("Failed to initialise routes:", err);
    return res.status(500).json({ message: "Server initialisation failed" });
  }
  app(req, res);
}
