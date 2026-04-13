import { describe, expect, it } from "vitest";

import {
  buildOnboardingPath,
  buildResetPasswordPath,
  extractResetToken,
  normalizeLegacyHashUrl,
} from "./publicRoutes";

describe("publicRoutes", () => {
  it("builds canonical onboarding paths", () => {
    expect(buildOnboardingPath("CUSTOMER")).toBe("/register/customer");
    expect(buildOnboardingPath("PROFESSIONAL")).toBe("/register/professional");
    expect(buildOnboardingPath("CUSTOMER", "?category=cat-1")).toBe("/register/customer?category=cat-1");
  });

  it("normalizes legacy hash query onboarding urls into canonical paths", () => {
    expect(normalizeLegacyHashUrl("https://codebasefull.vercel.app/#/register?role=CUSTOMER")).toBe(
      "https://codebasefull.vercel.app/#/register/customer",
    );

    expect(normalizeLegacyHashUrl("https://codebasefull.vercel.app/?role=PROFESSIONAL#/register")).toBe(
      "https://codebasefull.vercel.app/#/register/professional",
    );
  });

  it("normalizes legacy reset-password query urls into canonical token paths", () => {
    expect(normalizeLegacyHashUrl("https://codebasefull.vercel.app/#/reset-password?token=abc123")).toBe(
      "https://codebasefull.vercel.app/#/reset-password/abc123",
    );
  });

  it("extracts reset tokens from both canonical and legacy urls", () => {
    expect(buildResetPasswordPath("abc123")).toBe("/reset-password/abc123");
    expect(extractResetToken("/reset-password/abc123", "", "")).toBe("abc123");
    expect(extractResetToken("/reset-password", "?token=abc123", "")).toBe("abc123");
    expect(extractResetToken("/reset-password", "", "#/reset-password?token=abc123")).toBe("abc123");
  });
});
