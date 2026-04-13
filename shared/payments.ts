export type PaymentProvider = "STRIPE";
export type PaymentMode = "LIVE" | "TEST" | "DEMO";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface CreditPackageSnapshot {
  id: string;
  name: string;
  price: string;
  currency: string;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
}

export interface PaymentConfigResponse {
  provider: PaymentProvider;
  ready: boolean;
  mode: PaymentMode | "DISABLED";
  publishableKey: string | null;
  missing: string[];
  message: string;
}

export function isConfiguredSecret(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !normalized.includes("placeholder") && !normalized.includes("your_");
}

export function detectStripeMode(secretKey?: string | null): PaymentMode | "DISABLED" {
  if (!isConfiguredSecret(secretKey)) return "DISABLED";
  return secretKey!.startsWith("sk_live_") ? "LIVE" : "TEST";
}

export function paymentCountsTowardsLiveRevenue(payment: {
  mode?: string | null;
  status?: string | null;
  fulfilledAt?: string | Date | null;
}) {
  return payment.mode === "LIVE" && payment.status === "COMPLETED" && !!payment.fulfilledAt;
}

