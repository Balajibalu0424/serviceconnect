/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_OTP_CODE } from "@shared/verification";

const insertedValues = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const limitMock = vi.fn();
const orderByMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();

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

beforeEach(() => {
  vi.clearAllMocks();
  updateSet.mockReturnValue({ where: updateWhere });
  insertedValues.mockResolvedValue([]);
  updateWhere.mockResolvedValue([]);
  selectMock.mockReturnValue({ from: fromMock });
  fromMock.mockReturnValue({ where: whereMock });
  whereMock.mockReturnValue({ orderBy: orderByMock, limit: limitMock });
  orderByMock.mockReturnValue({ limit: limitMock });
  limitMock.mockResolvedValue([]);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("verificationService", () => {
  it("issues centralized demo OTP challenges", async () => {
    const { issueVerificationChallenge } = await import("./verificationService");

    const result = await issueVerificationChallenge({
      sessionId: "session-1",
      channel: "EMAIL",
      target: "jane@example.com",
      purpose: "ONBOARDING",
    });

    expect(result.success).toBe(true);
    expect(result.demoCode).toBe(DEMO_OTP_CODE);
    expect(insertedValues).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-1",
      channel: "EMAIL",
      target: "jane@example.com",
      purpose: "ONBOARDING",
    }));
  });

  it("verifies phone challenges with the shared demo code", async () => {
    const { verifyVerificationChallenge } = await import("./verificationService");

    limitMock.mockResolvedValueOnce([
      {
        id: "challenge-1",
        hashedCode: "hashed:anything",
        attempts: 0,
        maxAttempts: 5,
      },
    ]);

    const isValid = await verifyVerificationChallenge({
      userId: "user-1",
      channel: "PHONE",
      code: DEMO_OTP_CODE,
    });

    expect(isValid).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      verifiedAt: expect.any(Date),
    }));
  });

  it("increments attempts for invalid codes", async () => {
    const { verifyVerificationChallenge } = await import("./verificationService");

    limitMock.mockResolvedValueOnce([
      {
        id: "challenge-2",
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
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      attempts: 1,
    }));
  });
});
