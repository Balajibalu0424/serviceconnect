import rateLimit, { ipKeyGenerator, type Store, type IncrementResponse } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import type { AuthRequest } from "./auth";

function buildKey(req: Request) {
  const authReq = req as AuthRequest;
  if (authReq.user?.userId) {
    return authReq.user.userId;
  }

  return ipKeyGenerator(req.ip || "unknown");
}

/**
 * Upstash REST store — persistent, shared across Vercel serverless invocations.
 * Enabled automatically when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set. Falls back to the default in-memory store otherwise so local dev
 * continues to work.
 *
 * Works over HTTPS REST (no persistent TCP connection) which is the only
 * viable shared-store option on Vercel's serverless runtime.
 */
class UpstashRestStore implements Store {
  windowMs: number = 0;
  prefix: string;
  url: string;
  token: string;

  constructor(opts: { url: string; token: string; prefix: string }) {
    this.url = opts.url.replace(/\/+$/, "");
    this.token = opts.token;
    this.prefix = opts.prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private async pipeline(commands: (string | number)[][]): Promise<any[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Upstash error ${res.status}`);
    return res.json();
  }

  private fullKey(key: string) {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const fk = this.fullKey(key);
    const ttlSec = Math.ceil(this.windowMs / 1000);
    const [incr, _expire, pttl] = await this.pipeline([
      ["INCR", fk],
      ["EXPIRE", fk, ttlSec, "NX"],
      ["PTTL", fk],
    ]);
    const totalHits = Number(incr?.result ?? 0);
    const ttlMs = Number(pttl?.result ?? this.windowMs);
    return {
      totalHits,
      resetTime: new Date(Date.now() + (ttlMs > 0 ? ttlMs : this.windowMs)),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.pipeline([["DECR", this.fullKey(key)]]);
  }

  async resetKey(key: string): Promise<void> {
    await this.pipeline([["DEL", this.fullKey(key)]]);
  }
}

function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function buildStore(prefix: string): Store | undefined {
  if (!upstashConfigured()) return undefined;
  return new UpstashRestStore({
    url: process.env.UPSTASH_REDIS_REST_URL as string,
    token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    prefix: `sc:rl:${prefix}`,
  });
}

function buildLimiter(options: {
  name: string;
  windowMs: number;
  max: number;
  message: string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: buildKey,
    store: buildStore(options.name),
    handler: (_req, res) => {
      res.status(429).json({ error: options.message });
    },
  });
}

export function isPersistentRateLimitActive() {
  return upstashConfigured();
}

export const loginRateLimiter = buildLimiter({
  name: "login",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Please try again shortly.",
});

export const forgotPasswordRateLimiter = buildLimiter({
  name: "forgot",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests. Please wait before trying again.",
});

export const onboardingSessionRateLimiter = buildLimiter({
  name: "onbsess",
  windowMs: 60 * 60 * 1000,
  max: 25,
  message: "Too many onboarding attempts. Please wait before starting again.",
});

export const onboardingChatRateLimiter = buildLimiter({
  name: "onbchat",
  windowMs: 60 * 1000,
  max: 18,
  message: "You're sending onboarding messages too quickly. Please pause for a moment.",
});

export const otpSendRateLimiter = buildLimiter({
  name: "otpsend",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many verification code requests. Please wait before requesting another code.",
});

export const otpVerifyRateLimiter = buildLimiter({
  name: "otpverify",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many verification attempts. Please wait before trying another code.",
});

export const chatMessageRateLimiter = buildLimiter({
  name: "chatmsg",
  windowMs: 60 * 1000,
  max: 30,
  message: "You're sending messages too quickly. Please slow down.",
});

export const supportTicketRateLimiter = buildLimiter({
  name: "support",
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: "Too many support requests. Please wait before opening another ticket.",
});

export const quoteSubmissionRateLimiter = buildLimiter({
  name: "quote",
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Too many quote submissions. Please wait before sending another quote.",
});

export const paymentIntentRateLimiter = buildLimiter({
  name: "payintent",
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many checkout attempts. Please wait a few minutes before trying again.",
});

export const reportRateLimiter = buildLimiter({
  name: "report",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many reports submitted. Please wait before submitting more.",
});
