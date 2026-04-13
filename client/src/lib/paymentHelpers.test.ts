import { describe, expect, it } from "vitest";
import { detectStripeMode, isConfiguredSecret, paymentCountsTowardsLiveRevenue } from "@shared/payments";

describe("payment helpers", () => {
  it("treats placeholders as unconfigured secrets", () => {
    expect(isConfiguredSecret("")).toBe(false);
    expect(isConfiguredSecret("pk_test_your_publishable_key_here")).toBe(false);
    expect(isConfiguredSecret("placeholder")).toBe(false);
    expect(isConfiguredSecret("pk_test_real_value")).toBe(true);
  });

  it("detects Stripe live and test modes", () => {
    expect(detectStripeMode("")).toBe("DISABLED");
    expect(detectStripeMode("sk_test_123")).toBe("TEST");
    expect(detectStripeMode("sk_live_123")).toBe("LIVE");
  });

  it("counts only fulfilled live payments toward revenue", () => {
    expect(paymentCountsTowardsLiveRevenue({ mode: "LIVE", status: "COMPLETED", fulfilledAt: "2026-04-13T10:00:00.000Z" })).toBe(true);
    expect(paymentCountsTowardsLiveRevenue({ mode: "TEST", status: "COMPLETED", fulfilledAt: "2026-04-13T10:00:00.000Z" })).toBe(false);
    expect(paymentCountsTowardsLiveRevenue({ mode: "LIVE", status: "PENDING", fulfilledAt: "2026-04-13T10:00:00.000Z" })).toBe(false);
    expect(paymentCountsTowardsLiveRevenue({ mode: "LIVE", status: "COMPLETED", fulfilledAt: null })).toBe(false);
  });
});
