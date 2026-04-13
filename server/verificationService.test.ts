/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertedValues = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const limitMock = vi.fn();
const orderByMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const sendOtpEmail = vi.fn();
const sendPhoneVerificationCode = vi.fn();
const checkPhoneVerificationCode = vi.fn();
const canUseOtpFallback = vi.fn();
const getOtpMasterCode = vi.fn();

vi.mock("./db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: insertedValues,
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
    select: selectMock,
  },
}));

vi.mock("./auth", () => ({
  hashPassword: vi.fn(async (value: string) => `hashed:${value}`),
  comparePassword: vi.fn(async (value: string, hash: string) => hash === `hashed:${value}`),
}));

vi.mock("./deliveryConfig", () => ({
  canUseOtpFallback,
  getOtpMasterCode,
}));

vi.mock("./emailService", () => ({
  sendOtpEmail,
}));

vi.mock("./smsVerifyService", () => ({
  sendPhoneVerificationCode,
  checkPhoneVerificationCode,
  normalizePhoneNumber: vi.fn((value: string) => value),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  updateSet.mockReturnValue({ where: updateWhere });
  insertedValues.mockResolvedValue([]);
  updateWhere.mockResolvedValue([]);
  selectMock.mockReturnValue({ from: fromMock });
  fromMock.mockReturnValue({ where: whereMock });
  whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock });
  orderByMock.mockReturnValue({ limit: limitMock });
  limitMock.mockResolvedValue([]);

  canUseOtpFallback.mockReturnValue(true);
  getOtpMasterCode.mockReturnValue("123456");
  sendOtpEmail.mockResolvedValue(undefined);
  sendPhoneVerificationCode.mockResolvedValue("+353871234567");
  checkPhoneVerificationCode.mockResolvedValue(false);
});

describe("verificationService", () => {
  it("issues provider-backed email OTP challenges when delivery is configured", async () => {
    const { issueVerificationChallenge } = await import("./verificationService");

    const result = await issueVerificationChallenge({
      sessionId: "session-1",
      channel: "EMAIL",
      target: "jane@example.com",
      purpose: "ONBOARDING",
    });

    expect(result.success).toBe(true);
    expect(result.deliveryMode).toBe("PROVIDER");
    expect(result.fallbackCode).toBeUndefined();
    expect(result.maskedTarget).toBe("ja***@example.com");
    expect(sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        expiresInMinutes: expect.any(Number),
      }),
    );
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        channel: "EMAIL",
        target: "jane@example.com",
        purpose: "ONBOARDING",
        hashedCode: expect.stringMatching(/^hashed:\d{6}$/),
      }),
    );
  });

  it("returns a development fallback code when provider delivery fails but fallback is allowed", async () => {
    sendOtpEmail.mockRejectedValueOnce(new Error("resend unavailable"));

    const { issueVerificationChallenge } = await import("./verificationService");

    const result = await issueVerificationChallenge({
      sessionId: "session-2",
      channel: "EMAIL",
      target: "builder@example.com",
      purpose: "ONBOARDING",
    });

    expect(result.success).toBe(true);
    expect(result.deliveryMode).toBe("DEV_FALLBACK");
    expect(result.fallbackCode).toBe("123456");
    expect(insertedValues).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "builder@example.com",
        hashedCode: "hashed:123456",
      }),
    );
  });

  it("verifies phone challenges through the provider check when available", async () => {
    const { verifyVerificationChallenge } = await import("./verificationService");

    limitMock.mockResolvedValueOnce([
      {
        id: "challenge-1",
        target: "+353871234567",
        hashedCode: "hashed:000000",
        attempts: 0,
        maxAttempts: 5,
      },
    ]);
    checkPhoneVerificationCode.mockResolvedValueOnce(true);

    const isValid = await verifyVerificationChallenge({
      userId: "user-1",
      channel: "PHONE",
      code: "654321",
    });

    expect(isValid).toBe(true);
    expect(checkPhoneVerificationCode).toHaveBeenCalledWith("+353871234567", "654321");
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        verifiedAt: expect.any(Date),
      }),
    );
  });

  it("increments attempts for invalid codes", async () => {
    const { verifyVerificationChallenge } = await import("./verificationService");

    limitMock.mockResolvedValueOnce([
      {
        id: "challenge-2",
        target: "jane@example.com",
        hashedCode: "hashed:not-demo",
        attempts: 0,
        maxAttempts: 5,
      },
    ]);

    const isValid = await verifyVerificationChallenge({
      sessionId: "session-2",
      channel: "EMAIL",
      code: "000000",
    });

    expect(isValid).toBe(false);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
      }),
    );
  });
});
