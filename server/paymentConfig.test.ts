/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("paymentConfig", () => {
  it("reports missing Stripe configuration clearly", async () => {
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_WEBHOOK_SECRET = "";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "";

    const { getStripePaymentConfig, getStripeClient } = await import("./paymentConfig");
    const config = getStripePaymentConfig();

    expect(config.ready).toBe(false);
    expect(config.mode).toBe("DISABLED");
    expect(config.missing).toEqual([
      "STRIPE_SECRET_KEY",
      "VITE_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]);
    expect(getStripeClient()).toBeNull();
  });

  it("supports the new publishable key and detects live mode", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_live_example";
    process.env.VITE_STRIPE_PUBLIC_KEY = "";

    const { getStripePaymentConfig, getStripeMode } = await import("./paymentConfig");
    const config = getStripePaymentConfig();

    expect(config.ready).toBe(true);
    expect(config.mode).toBe("LIVE");
    expect(config.publishableKey).toBe("pk_live_example");
    expect(getStripeMode()).toBe("LIVE");
  });

  it("falls back to the legacy publishable key name for older environments", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "";
    process.env.VITE_STRIPE_PUBLIC_KEY = "pk_test_legacy";

    const { getStripePaymentConfig } = await import("./paymentConfig");
    const config = getStripePaymentConfig();

    expect(config.ready).toBe(true);
    expect(config.mode).toBe("TEST");
    expect(config.publishableKey).toBe("pk_test_legacy");
  });
});
