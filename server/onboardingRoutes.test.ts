/* @vitest-environment node */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onboardingService = {
  completeOnboardingSession: vi.fn(),
  createOnboardingSession: vi.fn(),
  getOnboardingSession: vi.fn(),
  listActiveCategories: vi.fn(),
  markOnboardingVerification: vi.fn(),
  patchOnboardingSession: vi.fn(),
  processOnboardingChat: vi.fn(),
  recordOnboardingOtpSent: vi.fn(),
};

const verificationService = {
  issueVerificationChallenge: vi.fn(),
  verifyVerificationChallenge: vi.fn(),
};

vi.mock("./onboardingService", () => onboardingService);
vi.mock("./verificationService", () => verificationService);

function buildSession(overrides: Partial<any> = {}) {
  return {
    id: "session-1",
    role: "CUSTOMER",
    currentStep: "PHONE_OTP",
    status: "ACTIVE",
    payload: {
      role: "CUSTOMER",
      customerJob: {
        title: "Kitchen tap leak",
        description: "Tap is leaking under the sink",
        categoryId: "cat-1",
        categoryLabel: "Plumbing",
        urgency: "URGENT",
        locationText: "Dublin 8",
        budgetMin: null,
        budgetMax: null,
        preferredDate: null,
        completionIssues: [],
        aiQualityScore: 92,
        aiQualityPrompt: null,
      },
      professionalProfile: null,
      personalDetails: {
        firstName: "Jane",
        lastName: "Murphy",
        email: "jane@example.com",
        phone: "+353871234567",
      },
      password: "",
    },
    transcript: [],
    verificationState: {
      emailVerified: false,
      phoneVerified: false,
      emailLastSentAt: null,
      phoneLastSentAt: null,
    },
    expiresAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

describe("registerOnboardingRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates role-based onboarding sessions", async () => {
    onboardingService.createOnboardingSession.mockResolvedValueOnce(buildSession());
    const { registerOnboardingRoutes } = await import("./onboardingRoutes");

    const app = express();
    app.use(express.json());
    registerOnboardingRoutes(app);

    const response = await request(app)
      .post("/api/onboarding/sessions")
      .send({ role: "CUSTOMER" });

    expect(response.status).toBe(201);
    expect(onboardingService.createOnboardingSession).toHaveBeenCalledWith("CUSTOMER", undefined);
    expect(response.body.role).toBe("CUSTOMER");
  });

  it("sends OTP challenges against the current onboarding session", async () => {
    const phoneSession = buildSession({ currentStep: "PHONE_OTP" });
    onboardingService.getOnboardingSession.mockResolvedValueOnce(phoneSession);
    verificationService.issueVerificationChallenge.mockResolvedValueOnce({ success: true, message: "sent", expiresAt: new Date().toISOString() });
    onboardingService.recordOnboardingOtpSent.mockResolvedValueOnce({
      ...phoneSession,
      verificationState: { ...phoneSession.verificationState, phoneLastSentAt: new Date().toISOString() },
    });

    const { registerOnboardingRoutes } = await import("./onboardingRoutes");
    const app = express();
    app.use(express.json());
    registerOnboardingRoutes(app);

    const response = await request(app)
      .post("/api/onboarding/sessions/session-1/otp/send")
      .send({ channel: "PHONE" });

    expect(response.status).toBe(200);
    expect(verificationService.issueVerificationChallenge).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      channel: "PHONE",
      target: "+353871234567",
    }));
    expect(response.body.session.verificationState.phoneLastSentAt).toBeTruthy();
  });

  it("rejects invalid OTP verification attempts", async () => {
    verificationService.verifyVerificationChallenge.mockResolvedValueOnce(false);
    const { registerOnboardingRoutes } = await import("./onboardingRoutes");
    const app = express();
    app.use(express.json());
    registerOnboardingRoutes(app);

    const response = await request(app)
      .post("/api/onboarding/sessions/session-1/otp/verify")
      .send({ channel: "EMAIL", code: "000000" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid or expired/i);
  });

  it("returns role-aware redirect targets after completion", async () => {
    onboardingService.completeOnboardingSession.mockResolvedValueOnce({
      accessToken: "access",
      refreshToken: "refresh",
      user: { id: "pro-1", role: "PROFESSIONAL" },
      redirectTo: "/pro/dashboard",
      createdProfileId: "profile-1",
      nextPrompt: "Your account is ready.",
    });

    const { registerOnboardingRoutes } = await import("./onboardingRoutes");
    const app = express();
    app.use(express.json());
    registerOnboardingRoutes(app);

    const response = await request(app)
      .post("/api/onboarding/sessions/session-1/complete")
      .send({ password: "Strongpass1" });

    expect(response.status).toBe(201);
    expect(response.body.redirectTo).toBe("/pro/dashboard");
    expect(onboardingService.completeOnboardingSession).toHaveBeenCalledWith("session-1", "Strongpass1", expect.anything());
  });
});
