import type { Request, Response, NextFunction } from "express";

/**
 * Cloudflare Turnstile verification.
 *
 * Enabled automatically when TURNSTILE_SECRET_KEY is set. When disabled, the
 * middleware is a no-op so local dev and staging without Turnstile keep
 * working.
 *
 * Clients send the widget response token in:
 *   - request header: `x-turnstile-token`, OR
 *   - request body:   `turnstileToken`
 *
 * The public site key (TURNSTILE_SITE_KEY) is exposed to the frontend via
 * /api/public/config so the widget can render.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isCaptchaEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export function getCaptchaSiteKey() {
  return process.env.TURNSTILE_SITE_KEY || null;
}

async function verifyToken(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const json: any = await res.json();
    return Boolean(json?.success);
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}

/**
 * Express middleware factory. When Turnstile is enabled, requires a valid
 * token; otherwise passes through. Responds 400 on invalid token.
 */
export function requireCaptcha(): (req: Request, res: Response, next: NextFunction) => void {
  return async (req, res, next) => {
    if (!isCaptchaEnabled()) return next();
    const token =
      (req.headers["x-turnstile-token"] as string | undefined) ||
      (req.body && typeof req.body === "object" ? (req.body.turnstileToken as string | undefined) : undefined) ||
      "";
    const ok = await verifyToken(token, req.ip);
    if (!ok) {
      return res.status(400).json({ error: "Captcha verification failed. Please refresh and try again." });
    }
    next();
  };
}
