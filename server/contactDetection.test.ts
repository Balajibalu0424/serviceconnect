/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { detectObfuscatedPhone, normalizeText, isContactSharingAttempt } from "./contactDetection";
import { moderateText } from "./moderationService";

// ─── HELPER ─────────────────────────────────────────────────────────────────────

function expectBlocked(text: string, description?: string) {
  const result = detectObfuscatedPhone(text);
  expect(result.blocked, `Expected BLOCKED for "${text}"${description ? ` (${description})` : ""} but got confidence=${result.confidence}, digits="${result.reconstructedDigits}", reasons=${JSON.stringify(result.reasons)}`).toBe(true);
}

function expectAllowed(text: string, description?: string) {
  const result = detectObfuscatedPhone(text);
  expect(result.blocked, `Expected ALLOWED for "${text}"${description ? ` (${description})` : ""} but got confidence=${result.confidence}, digits="${result.reconstructedDigits}", reasons=${JSON.stringify(result.reasons)}`).toBe(false);
}

// ─── EXACT BYPASS EXAMPLE ───────────────────────────────────────────────────────

describe("exact reported bypass", () => {
  it("blocks: zero eight nine eight four zerosevin one tre tre", () => {
    expectBlocked("zero eight nine eight four zerosevin one tre tre");
  });

  it("moderateText blocks it end-to-end", () => {
    const result = moderateText("zero eight nine eight four zerosevin one tre tre", { fieldName: "message" });
    expect(result.blocked).toBe(true);
    // reason may be "contact_info_detected" (regex layer) or "obfuscated_phone_detected" (new layer)
    expect(result.blocked).toBe(true);
  });
});

// ─── DIRECT DIGITS ──────────────────────────────────────────────────────────────

describe("direct digit phone numbers", () => {
  it("blocks Irish mobile: 0898471234", () => {
    expectBlocked("0898471234");
  });

  it("blocks Irish mobile with spaces: 089 847 1234", () => {
    expectBlocked("089 847 1234");
  });

  it("blocks Irish mobile with dashes: 089-847-1234", () => {
    expectBlocked("089-847-1234");
  });

  it("blocks spaced single digits: 0 8 9 8 4 7 1 2 3 4", () => {
    expectBlocked("0 8 9 8 4 7 1 2 3 4");
  });

  it("blocks Irish intl format: +353898471234", () => {
    expectBlocked("+353898471234");
  });

  it("blocks UK mobile: 07912345678", () => {
    expectBlocked("07912345678");
  });

  it("blocks dots between digits: 0.8.9.8.4.7.1.2.3.4", () => {
    expectBlocked("0.8.9.8.4.7.1.2.3.4");
  });
});

// ─── WRITTEN NUMBER WORDS ───────────────────────────────────────────────────────

describe("written number words", () => {
  it("blocks: oh eight nine one two three four five six", () => {
    expectBlocked("oh eight nine one two three four five six");
  });

  it("blocks: zero eight seven one two three four five six seven", () => {
    expectBlocked("zero eight seven one two three four five six seven");
  });

  it("blocks: o eight nine eight four seven one three three", () => {
    expectBlocked("o eight nine eight four seven one three three");
  });
});

// ─── MISSPELLED NUMBER WORDS ────────────────────────────────────────────────────

describe("misspelled number words", () => {
  it("blocks 'sevin' for seven", () => {
    expectBlocked("oh eight nine one two three four sevin six");
  });

  it("blocks 'siven' for seven", () => {
    expectBlocked("oh eight nine one two three four siven six");
  });

  it("blocks 'sevn' for seven", () => {
    expectBlocked("oh eight nine one two three four sevn six");
  });

  it("blocks 'tre' for three", () => {
    expectBlocked("oh eight nine one two tre four five six");
  });

  it("blocks 'tree' for three", () => {
    expectBlocked("oh eight nine one two tree four five six");
  });

  it("blocks 'ate' for eight", () => {
    expectBlocked("oh ate nine one two three four five six");
  });

  it("blocks 'eit' for eight", () => {
    expectBlocked("oh eit nine one two three four five six");
  });

  it("blocks 'nien' for nine", () => {
    expectBlocked("oh eight nien one two three four five six");
  });

  it("blocks 'for' for four (in sequence context)", () => {
    expectBlocked("oh eight nine one two three for five six");
  });

  it("blocks 'won' for one", () => {
    expectBlocked("oh eight nine won two three four five six");
  });
});

// ─── MERGED NUMBER WORDS ────────────────────────────────────────────────────────

describe("merged/concatenated number words", () => {
  it("blocks 'zerosevin' → 07", () => {
    expectBlocked("zerosevin eight nine one two three four five");
  });

  it("blocks 'onetwo' → 12", () => {
    expectBlocked("oh eight nine onetwo three four five six");
  });

  it("blocks 'zeroeightnine' → 089", () => {
    expectBlocked("zeroeightnine one two three four five six seven");
  });

  it("blocks 'eightseven' in sequence", () => {
    expectBlocked("zero eightseven one two three four five six");
  });

  it("blocks 'fivesix' in sequence", () => {
    expectBlocked("oh eight nine one two three fivesix seven eight");
  });
});

// ─── HYBRID OBFUSCATION ────────────────────────────────────────────────────────

describe("hybrid digit + word obfuscation", () => {
  it("blocks: 089 eight four sevin one tre tre", () => {
    expectBlocked("089 eight four sevin one tre tre");
  });

  it("blocks: oh 8 nine 8 4 sevin 1 tre tre", () => {
    expectBlocked("oh 8 nine 8 4 sevin 1 tre tre");
  });

  it("blocks: 0 eight 9 8 four 7 one 3 3", () => {
    expectBlocked("0 eight 9 8 four 7 one 3 3");
  });

  it("blocks: zero 8 9 eight 4 seven 1 three 3", () => {
    expectBlocked("zero 8 9 eight 4 seven 1 three 3");
  });
});

// ─── REPEATED FRAGMENTS ────────────────────────────────────────────────────────

describe("repeated fragments", () => {
  it("blocks 'tre tre' in a sequence", () => {
    expectBlocked("oh eight nine one two three four five tre tre");
  });

  it("blocks: one one two two three three four", () => {
    expectBlocked("oh eight nine one one two two three three four");
  });
});

// ─── CONTACT INTENT + DIGITS ───────────────────────────────────────────────────

describe("contact intent combined with digits", () => {
  it("moderateText blocks 'call me on' with digits", () => {
    const result = moderateText("call me on oh eight nine one two three four", { fieldName: "message" });
    expect(result.blocked).toBe(true);
  });

  it("moderateText blocks 'my number is' with words", () => {
    const result = moderateText("my number is zero eight nine eight four seven one three three", { fieldName: "message" });
    expect(result.blocked).toBe(true);
  });

  it("moderateText blocks 'text me' with a short digit sequence", () => {
    const result = moderateText("text me on oh eight nine four seven", { fieldName: "message" });
    expect(result.blocked).toBe(true);
  });

  it("moderateText blocks 'reach me at' with any contact reference", () => {
    const result = moderateText("reach me at my insta page", { fieldName: "message" });
    expect(result.blocked).toBe(true);
  });
});

// ─── PHONETIC DISGUISES ────────────────────────────────────────────────────────

describe("phonetic disguises", () => {
  it("blocks 'nein' for nine (German)", () => {
    expectBlocked("oh eight nein one two three four five six");
  });

  it("blocks 'acht' for eight (German)", () => {
    expectBlocked("oh acht nine one two three four five six");
  });

  it("blocks 'wan' for one (Irish)", () => {
    expectBlocked("oh eight nine wan two three four five six");
  });
});

// ─── LEET SPEAK / MIXED FORMAT ─────────────────────────────────────────────────

describe("leet speak and special formatting", () => {
  it("blocks 'thr33' for three", () => {
    expectBlocked("oh eight nine one two thr33 four five six");
  });

  it("blocks 's3ven' for seven", () => {
    expectBlocked("oh eight nine one two three four s3ven six");
  });
});

// ─── FALSE POSITIVE PROTECTION ─────────────────────────────────────────────────

describe("false positive protection", () => {
  it("allows normal conversation about a job", () => {
    expectAllowed("I need someone to fix my kitchen sink, the pipe under the basin is leaking");
  });

  it("allows discussion with small numbers", () => {
    expectAllowed("I need three coats of paint on two walls, about five hours of work");
  });

  it("allows pricing discussion", () => {
    expectAllowed("I can do it for two hundred and fifty euro, takes about four to five hours");
  });

  it("allows scheduling discussion", () => {
    expectAllowed("Can you come on Tuesday at three o'clock? I'm free all afternoon");
  });

  it("allows general chat with a few number words", () => {
    expectAllowed("The job took about three hours and the result was great");
  });

  it("allows text about counting", () => {
    expectAllowed("I have two bathrooms and one kitchen that need tiling");
  });

  it("allows text with 'for' used as preposition", () => {
    expectAllowed("Looking for a plumber for my house, need it done by Friday");
  });

  it("allows text mentioning 'one or two' casually", () => {
    expectAllowed("Just need one or two small repairs done in the kitchen");
  });

  it("allows review text", () => {
    expectAllowed("Five stars, excellent work, finished on time and very professional");
  });

  it("allows address-like text without being a phone", () => {
    expectAllowed("The property is at unit five, block three, main street");
  });
});

// ─── NORMALIZATION ─────────────────────────────────────────────────────────────

describe("normalizeText", () => {
  it("lowercases text", () => {
    expect(normalizeText("HELLO WORLD")).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeText("hello    world")).toBe("hello world");
  });

  it("strips zero-width characters", () => {
    expect(normalizeText("zero\u200Beight")).toBe("zeroeight");
  });

  it("converts dashes to spaces", () => {
    expect(normalizeText("oh-eight-nine")).toBe("oh eight nine");
  });
});

// ─── FULL PIPELINE (moderateText) ──────────────────────────────────────────────

describe("moderateText full pipeline", () => {
  it("blocks standard email address", () => {
    const r = moderateText("email me at john@example.com", { fieldName: "message" });
    expect(r.blocked).toBe(true);
  });

  it("blocks obfuscated email", () => {
    const r = moderateText("my email is john at gmail dot com", { fieldName: "message" });
    expect(r.blocked).toBe(true);
  });

  it("blocks social media invite", () => {
    const r = moderateText("add me on instagram @johndoe", { fieldName: "message" });
    expect(r.blocked).toBe(true);
  });

  it("blocks WhatsApp link", () => {
    const r = moderateText("message me on wa.me/353891234567", { fieldName: "message" });
    expect(r.blocked).toBe(true);
  });

  it("allows normal text", () => {
    const r = moderateText("When can you come to look at the leaking pipe?", { fieldName: "message" });
    expect(r.blocked).toBe(false);
  });

  it("allows phone when allowPhone=true (STANDARD unlock)", () => {
    const r = moderateText("My number is 089 847 1234", { fieldName: "message", allowPhone: true });
    expect(r.blocked).toBe(false);
  });

  it("includes logEntry when blocked", () => {
    const r = moderateText("zero eight nine eight four zerosevin one tre tre", {
      fieldName: "message",
      route: "POST /api/chat",
      surface: "chat",
      userId: "user-123",
      userRole: "CUSTOMER",
      referenceId: "conv-456",
    });
    expect(r.blocked).toBe(true);
    expect(r.logEntry).toBeDefined();
    expect(r.logEntry!.route).toBe("POST /api/chat");
    expect(r.logEntry!.userId).toBe("user-123");
    expect(r.logEntry!.confidence).toBeGreaterThan(0);
    expect(r.logEntry!.reconstructedDigits.length).toBeGreaterThanOrEqual(7);
  });
});
