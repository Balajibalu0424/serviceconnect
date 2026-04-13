import { randomBytes, randomInt } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { verificationChallenges } from "@shared/schema";
import { comparePassword, hashPassword } from "./auth";
import { VERIFICATION_CODE_TTL_MINUTES, VERIFICATION_MAX_ATTEMPTS } from "@shared/verification";
import type { VerificationChannel } from "@shared/onboarding";
import { canUseOtpFallback, getOtpMasterCode } from "./deliveryConfig";
import { sendOtpEmail } from "./emailService";
import { checkPhoneVerificationCode, normalizePhoneNumber, sendPhoneVerificationCode } from "./smsVerifyService";

type VerificationScope =
  | { sessionId: string; userId?: undefined }
  | { sessionId?: undefined; userId: string };

type IssueChallengeInput = VerificationScope & {
  channel: VerificationChannel;
  target: string;
  purpose?: "ONBOARDING" | "PHONE_UPDATE";
};

type VerifyChallengeInput = VerificationScope & {
  channel: VerificationChannel;
  code: string;
};

export interface VerificationResult {
  success: boolean;
  expiresAt: string;
  message: string;
  deliveryMode: "PROVIDER" | "DEV_FALLBACK";
  fallbackCode?: string;
  maskedTarget: string;
}

function buildScopeCondition(scope: VerificationScope) {
  if ("sessionId" in scope && scope.sessionId) {
    return eq(verificationChallenges.sessionId, scope.sessionId);
  }

  if ("userId" in scope && scope.userId) {
    return eq(verificationChallenges.userId, scope.userId);
  }

  throw new Error("Verification scope is missing a target identifier");
}

function buildActiveCondition(scope: VerificationScope, channel: VerificationChannel) {
  return and(
    buildScopeCondition(scope),
    eq(verificationChallenges.channel, channel),
    isNull(verificationChallenges.verifiedAt),
    isNull(verificationChallenges.invalidatedAt),
  )!;
}

function maskTarget(target: string, channel: VerificationChannel) {
  if (channel === "EMAIL") {
    const [name, domain] = target.split("@");
    if (!name || !domain) return target;
    return `${name.slice(0, 2)}***@${domain}`;
  }

  const compact = target.replace(/\s+/g, "");
  return `${compact.slice(0, 4)}***${compact.slice(-2)}`;
}

function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeTarget(channel: VerificationChannel, target: string) {
  const trimmed = target.trim();
  return channel === "PHONE" ? normalizePhoneNumber(trimmed) : trimmed.toLowerCase();
}

async function deliverChallenge(channel: VerificationChannel, target: string, code: string) {
  if (channel === "EMAIL") {
    await sendOtpEmail({ to: target, code, expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES });
    return "PROVIDER" as const;
  }

  await sendPhoneVerificationCode(target);
  return "PROVIDER" as const;
}

async function markChallengeFailed(challengeId: string, attempts: number, maxAttempts: number) {
  await db
    .update(verificationChallenges)
    .set({
      attempts,
      invalidatedAt: attempts >= maxAttempts ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(verificationChallenges.id, challengeId));
}

export async function invalidateVerificationChallenges(
  scope: VerificationScope,
  channel?: VerificationChannel,
): Promise<void> {
  const condition = channel
    ? buildActiveCondition(scope, channel)
    : and(
        buildScopeCondition(scope),
        isNull(verificationChallenges.verifiedAt),
        isNull(verificationChallenges.invalidatedAt),
      )!;

  await db
    .update(verificationChallenges)
    .set({ invalidatedAt: new Date(), updatedAt: new Date() })
    .where(condition);
}

export async function issueVerificationChallenge(input: IssueChallengeInput): Promise<VerificationResult> {
  const normalizedTarget = normalizeTarget(input.channel, input.target);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);
  const generatedCode = generateOtpCode();
  const fallbackCode = getOtpMasterCode();
  let deliveryMode: VerificationResult["deliveryMode"] = "PROVIDER";
  let hashedCode = await hashPassword(generatedCode);

  await invalidateVerificationChallenges(input, input.channel);

  try {
    deliveryMode = await deliverChallenge(input.channel, normalizedTarget, generatedCode);
    if (input.channel === "PHONE") {
      hashedCode = await hashPassword(randomBytes(32).toString("hex"));
    }
  } catch (error) {
    if (!canUseOtpFallback(input.channel)) {
      throw error;
    }
    deliveryMode = "DEV_FALLBACK";
    hashedCode = await hashPassword(fallbackCode);
  }

  await db.insert(verificationChallenges).values({
    sessionId: input.sessionId,
    userId: input.userId,
    channel: input.channel,
    purpose: input.purpose ?? (input.sessionId ? "ONBOARDING" : "PHONE_UPDATE"),
    target: normalizedTarget,
    hashedCode,
    attempts: 0,
    maxAttempts: VERIFICATION_MAX_ATTEMPTS,
    sentCount: 1,
    expiresAt,
    lastSentAt: new Date(),
  });

  return {
    success: true,
    expiresAt: expiresAt.toISOString(),
    message: `Verification code sent to your ${input.channel === "EMAIL" ? "email address" : "phone number"}.`,
    deliveryMode,
    fallbackCode: deliveryMode === "DEV_FALLBACK" ? fallbackCode : undefined,
    maskedTarget: maskTarget(normalizedTarget, input.channel),
  };
}

export async function verifyVerificationChallenge(input: VerifyChallengeInput): Promise<boolean> {
  const [challenge] = await db
    .select()
    .from(verificationChallenges)
    .where(
      and(
        buildActiveCondition(input, input.channel),
        gt(verificationChallenges.expiresAt, new Date()),
      )!,
    )
    .orderBy(desc(verificationChallenges.createdAt))
    .limit(1);

  if (!challenge) {
    return false;
  }

  let isValid = false;
  if (input.channel === "PHONE") {
    try {
      isValid = await checkPhoneVerificationCode(challenge.target, input.code);
    } catch {
      isValid = await comparePassword(input.code, challenge.hashedCode);
    }
  } else {
    isValid = await comparePassword(input.code, challenge.hashedCode);
  }

  if (!isValid) {
    const nextAttempts = challenge.attempts + 1;
    await markChallengeFailed(challenge.id, nextAttempts, challenge.maxAttempts);
    return false;
  }

  await db
    .update(verificationChallenges)
    .set({ verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(verificationChallenges.id, challenge.id));

  return true;
}
