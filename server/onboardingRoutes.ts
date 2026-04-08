import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  onboardingChatRequestSchema,
  onboardingCompleteSchema,
  onboardingOtpSendSchema,
  onboardingOtpVerifySchema,
  onboardingPatchSchema,
  onboardingRoleSchema,
} from "@shared/onboarding";
import {
  completeOnboardingSession,
  createOnboardingSession,
  getOnboardingSession,
  listActiveCategories,
  markOnboardingVerification,
  patchOnboardingSession,
  processOnboardingChat,
  recordOnboardingOtpSent,
} from "./onboardingService";
import { issueVerificationChallenge, verifyVerificationChallenge } from "./verificationService";

const createSessionSchema = z.object({
  role: onboardingRoleSchema,
  previousSessionId: z.string().trim().optional(),
});

function getRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function getOtpTarget(
  channel: "EMAIL" | "PHONE",
  session: Awaited<ReturnType<typeof getOnboardingSession>>,
): string {
  if (channel === "EMAIL") {
    const target = session.payload.personalDetails.email?.trim();
    if (!target) {
      throw new Error("Email address is missing from the onboarding session");
    }
    return target;
  }

  const target = session.payload.personalDetails.phone?.trim();
  if (!target) {
    throw new Error("Phone number is missing from the onboarding session");
  }
  return target;
}

function handleRouteError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not found") ||
    normalized.includes("expired") ||
    normalized.includes("invalid")
  ) {
    return res.status(400).json({ error: message });
  }

  if (
    normalized.includes("already registered") ||
    normalized.includes("must be completed") ||
    normalized.includes("incomplete")
  ) {
    return res.status(409).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

export function registerOnboardingRoutes(app: Express) {
  app.post("/api/onboarding/sessions", async (req: Request, res: Response) => {
    try {
      const { role, previousSessionId } = createSessionSchema.parse(req.body ?? {});
      const session = await createOnboardingSession(role, previousSessionId);
      return res.status(201).json(session);
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.get("/api/onboarding/sessions/:id", async (req: Request, res: Response) => {
    try {
      const session = await getOnboardingSession(getRouteParam(req.params.id));
      return res.json(session);
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.post("/api/onboarding/sessions/:id/chat", async (req: Request, res: Response) => {
    try {
      const { message } = onboardingChatRequestSchema.parse(req.body ?? {});
      const categories = await listActiveCategories();
      const session = await processOnboardingChat(getRouteParam(req.params.id), message, categories);
      return res.json(session);
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.patch("/api/onboarding/sessions/:id", async (req: Request, res: Response) => {
    try {
      const patch = onboardingPatchSchema.parse(req.body ?? {});
      const categories = await listActiveCategories();
      const session = await patchOnboardingSession(getRouteParam(req.params.id), patch, categories);
      return res.json(session);
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.post("/api/onboarding/sessions/:id/otp/send", async (req: Request, res: Response) => {
    try {
      const { channel } = onboardingOtpSendSchema.parse(req.body ?? {});
      const session = await getOnboardingSession(getRouteParam(req.params.id));
      const target = getOtpTarget(channel, session);

      const challenge = await issueVerificationChallenge({
        sessionId: session.id,
        channel,
        target,
        purpose: "ONBOARDING",
      });

      const updatedSession = await recordOnboardingOtpSent(session.id, channel);

      return res.json({
        challenge,
        session: updatedSession,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.post("/api/onboarding/sessions/:id/otp/verify", async (req: Request, res: Response) => {
    try {
      const { channel, code } = onboardingOtpVerifySchema.parse(req.body ?? {});
      const isValid = await verifyVerificationChallenge({
        sessionId: getRouteParam(req.params.id),
        channel,
        code,
      });

      if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }

      const session = await markOnboardingVerification(getRouteParam(req.params.id), channel);
      return res.json({ success: true, session });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  app.post("/api/onboarding/sessions/:id/complete", async (req: Request, res: Response) => {
    try {
      const { password } = onboardingCompleteSchema.parse(req.body ?? {});
      const result = await completeOnboardingSession(getRouteParam(req.params.id), password, req.ip);
      return res.status(201).json(result);
    } catch (error) {
      return handleRouteError(res, error);
    }
  });
}
