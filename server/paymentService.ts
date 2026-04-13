import { randomUUID } from "crypto";
import Stripe from "stripe";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { getStripeClient, getStripeMode, getStripePaymentConfig } from "./paymentConfig";
import {
  creditPackages,
  creditTransactions,
  paymentWebhookEvents,
  payments,
  users,
} from "@shared/schema";
import type { CreditPackageSnapshot } from "@shared/payments";

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PaymentConfigurationError extends Error {
  code = "PAYMENTS_NOT_CONFIGURED";
}

function getFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown payment provider error";
}

function buildCreditPackageSnapshot(pkg: typeof creditPackages.$inferSelect): CreditPackageSnapshot {
  const price = String(pkg.price);
  const bonusCredits = pkg.bonusCredits ?? 0;

  return {
    id: pkg.id,
    name: pkg.name,
    price,
    currency: "EUR",
    credits: pkg.credits,
    bonusCredits,
    totalCredits: pkg.credits + bonusCredits,
  };
}

function extractPackageSnapshot(payment: typeof payments.$inferSelect) {
  const snapshot = (payment.metadata as Record<string, unknown> | null)?.packageSnapshot as CreditPackageSnapshot | undefined;
  if (!snapshot) {
    throw new Error(`Payment ${payment.id} is missing its package snapshot.`);
  }
  return snapshot;
}

export function confirmedLiveRevenueFilter() {
  return and(
    eq(payments.status, "COMPLETED"),
    eq(payments.mode, "LIVE"),
    isNotNull(payments.fulfilledAt),
  );
}

export async function createCreditPackagePaymentIntent(userId: string, packageId: string) {
  const config = getStripePaymentConfig();
  if (!config.ready) {
    throw new PaymentConfigurationError(config.message);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    throw new PaymentConfigurationError("Stripe is not configured.");
  }
  const mode = getStripeMode();
  if (mode === "DISABLED") {
    throw new PaymentConfigurationError("Stripe is not configured.");
  }

  const [pkg] = await db.select().from(creditPackages).where(and(eq(creditPackages.id, packageId), eq(creditPackages.isActive, true)));
  if (!pkg) {
    throw new Error("Package not found");
  }

  const snapshot = buildCreditPackageSnapshot(pkg);
  const idempotencyKey = randomUUID();

  const [payment] = await db.insert(payments).values({
    userId,
    amount: snapshot.price,
    currency: snapshot.currency,
    status: "PENDING",
    provider: "STRIPE",
    mode,
    paymentMethod: "stripe",
    idempotencyKey,
    description: `Purchased ${snapshot.name}: ${snapshot.totalCredits} credits`,
    referenceType: "CREDIT_PACKAGE",
    referenceId: packageId,
    metadata: {
      packageSnapshot: snapshot,
      fulfillmentSource: "stripe_webhook",
    },
  }).returning();

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(snapshot.price) * 100),
      currency: snapshot.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentId: payment.id,
        packageId: snapshot.id,
        userId,
      },
      receipt_email: undefined,
    }, {
      idempotencyKey,
    });

    await db.update(payments).set({
      stripePaymentId: intent.id,
      metadata: {
        ...((payment.metadata as Record<string, unknown> | null) ?? {}),
        packageSnapshot: snapshot,
        stripeStatus: intent.status,
      },
    }).where(eq(payments.id, payment.id));

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      publishableKey: config.publishableKey,
      mode: config.mode,
      packageSnapshot: snapshot,
    };
  } catch (error) {
    await db.update(payments).set({
      status: "FAILED",
      failedAt: new Date(),
      failureReason: getFailureMessage(error),
    }).where(eq(payments.id, payment.id));
    throw error;
  }
}

async function applyCreditPurchaseFulfillment(
  tx: PaymentTransaction,
  payment: typeof payments.$inferSelect,
  intent: Stripe.PaymentIntent,
) {
  const snapshot = extractPackageSnapshot(payment);

  if (payment.fulfilledAt && payment.status === "COMPLETED") {
    return { paymentId: payment.id, userId: payment.userId, creditsAdded: snapshot.totalCredits, alreadyFulfilled: true };
  }

  const [user] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, payment.userId)).for("update");
  if (!user) {
    throw new Error(`User ${payment.userId} not found for payment fulfillment.`);
  }

  const newBalance = user.balance + snapshot.totalCredits;
  await tx.update(users).set({ creditBalance: newBalance }).where(eq(users.id, payment.userId));
  await tx.insert(creditTransactions).values({
    userId: payment.userId,
    type: "PURCHASE",
    amount: snapshot.totalCredits,
    balanceAfter: newBalance,
    description: `Purchased ${snapshot.name}: ${snapshot.totalCredits} credits`,
    referenceType: "PAYMENT",
    referenceId: payment.id,
  });

  await tx.update(payments).set({
    status: "COMPLETED",
    fulfilledAt: new Date(),
    failedAt: null,
    failureReason: null,
    providerChargeId: typeof intent.latest_charge === "string" ? intent.latest_charge : payment.providerChargeId,
    metadata: {
      ...((payment.metadata as Record<string, unknown> | null) ?? {}),
      packageSnapshot: snapshot,
      stripeStatus: intent.status,
    },
  }).where(eq(payments.id, payment.id));

  return { paymentId: payment.id, userId: payment.userId, creditsAdded: snapshot.totalCredits, alreadyFulfilled: false };
}

export async function fulfillStripePaymentIntent(intent: Stripe.PaymentIntent) {
  const paymentIntentId = intent.id;

  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.stripePaymentId, paymentIntentId)).for("update");
    if (!payment) {
      throw new Error(`No payment record found for Stripe intent ${paymentIntentId}.`);
    }
    return applyCreditPurchaseFulfillment(tx, payment, intent);
  });
}

export async function markStripePaymentFailed(intentId: string, reason: string | null | undefined) {
  const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentId, intentId)).limit(1);
  if (!payment || payment.status === "COMPLETED") return payment ?? null;

  const [updated] = await db.update(payments).set({
    status: "FAILED",
    failedAt: new Date(),
    failureReason: reason ?? "Payment failed",
  }).where(eq(payments.id, payment.id)).returning();

  return updated;
}

export async function markStripePaymentRefunded(intentId: string, chargeId?: string | null) {
  const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentId, intentId)).limit(1);
  if (!payment) return null;

  const [updated] = await db.update(payments).set({
    status: "REFUNDED",
    providerChargeId: chargeId ?? payment.providerChargeId,
    metadata: {
      ...((payment.metadata as Record<string, unknown> | null) ?? {}),
      refundRecordedAt: new Date().toISOString(),
    },
  }).where(eq(payments.id, payment.id)).returning();

  return updated;
}

export async function registerStripeWebhookReceipt(event: Stripe.Event) {
  try {
    const [receipt] = await db.insert(paymentWebhookEvents).values({
      provider: "STRIPE",
      providerEventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    }).returning();
    return { duplicate: false, receipt };
  } catch (error: any) {
    if (error?.code === "23505") {
      return { duplicate: true, receipt: null };
    }
    throw error;
  }
}

export async function completeStripeWebhookReceipt(id: string, status: "PROCESSED" | "IGNORED" | "FAILED", details?: {
  paymentId?: string | null;
  errorMessage?: string | null;
}) {
  await db.update(paymentWebhookEvents).set({
    status,
    paymentId: details?.paymentId ?? null,
    errorMessage: details?.errorMessage ?? null,
    processedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(paymentWebhookEvents.id, id));
}
