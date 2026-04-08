import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { verificationChallenges } from "@shared/schema";
import { comparePassword, hashPassword } from "./auth";
import { DEMO_OTP_CODE, VERIFICATION_CODE_TTL_MINUTES, VERIFICATION_MAX_ATTEMPTS } from "@shared/verification";
import type { VerificationChannel } from "@shared/onboarding";

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
  demoCode?: string;
  message: string;
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
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);
  const hashedCode = await hashPassword(DEMO_OTP_CODE);

  await invalidateVerificationChallenges(input, input.channel);

  await db.insert(verificationChallenges).values({
    sessionId: input.sessionId,
    userId: input.userId,
    channel: input.channel,
    purpose: input.purpose ?? (input.sessionId ? "ONBOARDING" : "PHONE_UPDATE"),
    target: input.target,
    hashedCode,
    attempts: 0,
    maxAttempts: VERIFICATION_MAX_ATTEMPTS,
    sentCount: 1,
    expiresAt,
    lastSentAt: new Date(),
  });

  console.log(`[Verification] ${input.channel} demo OTP issued for ${input.target}: ${DEMO_OTP_CODE}`);

  return {
    success: true,
    expiresAt: expiresAt.toISOString(),
    demoCode: DEMO_OTP_CODE,
    message: `Verification code sent to your ${input.channel.toLowerCase()}.`,
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

  const isValid =
    input.code === DEMO_OTP_CODE ||
    (await comparePassword(input.code, challenge.hashedCode));

  if (!isValid) {
    const nextAttempts = challenge.attempts + 1;
    await db
      .update(verificationChallenges)
      .set({
        attempts: nextAttempts,
        invalidatedAt: nextAttempts >= challenge.maxAttempts ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(verificationChallenges.id, challenge.id));

    return false;
  }

  await db
    .update(verificationChallenges)
    .set({ verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(verificationChallenges.id, challenge.id));

  return true;
}
