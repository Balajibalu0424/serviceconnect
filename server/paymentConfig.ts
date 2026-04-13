import Stripe from "stripe";
import {
  detectStripeMode,
  isConfiguredSecret,
  type PaymentConfigResponse,
  type PaymentMode,
} from "@shared/payments";

let stripeClient: Stripe | null = null;
let stripeClientKey: string | null = null;

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

function getStripePublishableKey() {
  return process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLIC_KEY || "";
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

export function getStripePaymentConfig(): PaymentConfigResponse {
  const secretKey = getStripeSecretKey();
  const publishableKey = getStripePublishableKey();
  const webhookSecret = getWebhookSecret();
  const missing: string[] = [];
  if (!isConfiguredSecret(secretKey)) missing.push("STRIPE_SECRET_KEY");
  if (!isConfiguredSecret(publishableKey)) missing.push("VITE_STRIPE_PUBLISHABLE_KEY");
  if (!isConfiguredSecret(webhookSecret)) missing.push("STRIPE_WEBHOOK_SECRET");

  const mode = detectStripeMode(secretKey);
  const ready = missing.length === 0 && mode !== "DISABLED";

  return {
    provider: "STRIPE",
    ready,
    mode: ready ? mode : "DISABLED",
    publishableKey: ready ? publishableKey : null,
    missing,
    message: ready
      ? `Stripe ${mode === "LIVE" ? "live" : "test"} mode is configured.`
      : `Payments are disabled until ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} configured.`,
  };
}

export function getStripeClient() {
  const config = getStripePaymentConfig();
  if (!config.ready) return null;
  const secretKey = getStripeSecretKey();
  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
    });
    stripeClientKey = secretKey;
  }
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = getWebhookSecret();
  return isConfiguredSecret(webhookSecret) ? webhookSecret : null;
}

export function getStripeMode(): PaymentMode | "DISABLED" {
  return detectStripeMode(getStripeSecretKey());
}
