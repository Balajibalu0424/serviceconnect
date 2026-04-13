import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "./auth";

function buildKey(req: Request) {
  const authReq = req as AuthRequest;
  if (authReq.user?.userId) {
    return authReq.user.userId;
  }

  return ipKeyGenerator(req.ip || "unknown");
}

function buildLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: buildKey,
    handler: (_req, res) => {
      res.status(429).json({ error: options.message });
    },
  });
}

export const loginRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Please try again shortly.",
});

export const forgotPasswordRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many password reset requests. Please wait before trying again.",
});

export const onboardingSessionRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 25,
  message: "Too many onboarding attempts. Please wait before starting again.",
});

export const onboardingChatRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 18,
  message: "You're sending onboarding messages too quickly. Please pause for a moment.",
});

export const otpSendRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many verification code requests. Please wait before requesting another code.",
});

export const otpVerifyRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many verification attempts. Please wait before trying another code.",
});

export const chatMessageRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "You're sending messages too quickly. Please slow down.",
});

export const supportTicketRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: "Too many support requests. Please wait before opening another ticket.",
});

export const quoteSubmissionRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: "Too many quote submissions. Please wait before sending another quote.",
});
