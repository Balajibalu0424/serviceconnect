import { processMessageContent } from "./profanityFilter";

export interface ModerationOptions {
  /** When true, phone numbers are allowed (STANDARD tier unlock context only) */
  allowPhone?: boolean;
  /** Field name used in user-facing error messages */
  fieldName?: string;
}

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
  userMessage?: string;
  cleanedText: string;
  flags: string[];
  severity?: string;
}

// ─── Extended phone detection patterns ───────────────────────────────────────
// These supplement the patterns in profanityFilter.ts to catch bypass attempts

const EXTENDED_PHONE_PATTERNS: RegExp[] = [
  // Spaced single digits: "0 8 7 1 2 3 4 5 6" (7+ single digits separated by spaces/dashes)
  /\b(\d[\s\-]){6,}\d\b/g,
  // Written number words in sequence (6+ consecutive)
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought)(\s+(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought)){5,}\b/gi,
  // "oh eight seven" style Irish mobile opener
  /\b(oh|zero|0)\s*(eight|ate|8)\s*(seven|7)\b/gi,
  // Separator bypass with dots or slashes: "087.123.4567" or "087/123/4567"
  /\b0\d{2}[\.\/\\]\d{3}[\.\/\\]\d{4}\b/g,
  // Partial obfuscation with asterisks: "087 123 ****" still reveals structure
  /\b0\d{2}\s+\d{3}\s+[\d\*]{4}\b/g,
  // Parenthetical format: (087) 123 4567
  /\(\s*0\d{2}\s*\)\s*\d{3}[\s\-]\d{4}/g,
  // Digit-word-digit pattern: "oh 87 one two three four five six"
  /\b(?:oh|zero|0)\s*(?:eight|8)\s*(?:\d|zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|oh)[\s,]+){4,}/gi,
  // Numbers disguised with dots/commas/underscores between every digit
  /\b\d[._,]\d[._,]\d[._,]\d[._,]\d[._,]\d[._,]\d/g,
  // "Call me on" / "text me" / "ring me" with any digit sequence
  /(?:call|text|ring|phone|whatsapp|message|contact)\s+(?:me|us)\s+(?:on|at)?\s*\d/gi,
  // "My number is" pattern
  /(?:my\s+(?:number|phone|mobile|cell)\s+(?:is|:))\s*[\d\s\-\.\(\)]{7,}/gi,
];

// Detect attempts to share contact info through creative language
const CONTACT_INTENT_PATTERNS: RegExp[] = [
  // "reach me at" / "find me on" / "contact me via"
  /(?:reach|find|contact|get|hit)\s+(?:me|us)\s+(?:at|on|via|through|@)/gi,
  // "my insta is" / "my snap is" / "my whatsapp is"
  /(?:my\s+(?:insta(?:gram)?|snap(?:chat)?|whatsapp|wa|tiktok|twitter|facebook|fb|telegram|signal|viber|number|email|phone|mobile)\s+(?:is|:))/gi,
  // Direct "add me" patterns
  /(?:add|follow|dm|message)\s+(?:me|us)\s+(?:on|@)/gi,
];

function hasExtendedPhonePattern(text: string): boolean {
  return EXTENDED_PHONE_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

function hasContactIntentPattern(text: string): boolean {
  return CONTACT_INTENT_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

/**
 * Moderates a text field for profanity and contact information.
 *
 * @param text - The text to moderate
 * @param options - `allowPhone` true only for STANDARD tier unlock contexts
 * @returns ModerationResult — if blocked=true, reject the submission with userMessage
 */
export function moderateText(text: string, options: ModerationOptions = {}): ModerationResult {
  const { allowPhone = false, fieldName = "content" } = options;

  if (!text || text.trim().length === 0) {
    return { blocked: false, cleanedText: text || "", flags: [] };
  }

  // Run through existing profanity + contact filter pipeline
  // shouldMaskContacts=true when allowPhone=false (mask/detect contact info)
  const processed = processMessageContent(text, !allowPhone);

  // Phone/contact info detected and not allowed
  if (!allowPhone && processed.filterFlags.some(f =>
    f.includes("PHONE") || f.includes("EMAIL") || f.includes("URL") ||
    f.includes("SOCIAL") || f.includes("SPOKEN") || f.includes("MIXED") || f.includes("POSTAL")
  )) {
    return {
      blocked: true,
      reason: "contact_info_detected",
      userMessage: `Your ${fieldName} appears to contain contact information (phone number, email, or social handle). For your safety, please keep all communication within ServiceConnect.`,
      cleanedText: processed.content,
      flags: processed.filterFlags,
      severity: processed.severity ?? undefined,
    };
  }

  // Extended phone pattern check (bypass attempts not caught by base patterns)
  if (!allowPhone && hasExtendedPhonePattern(text)) {
    return {
      blocked: true,
      reason: "phone_pattern_detected",
      userMessage: `Your ${fieldName} appears to contain a phone number. For your protection, contact details must stay within ServiceConnect's secure messaging system.`,
      cleanedText: text,
      flags: ["EXTENDED_PHONE"],
    };
  }

  // Contact intent detection (e.g., "reach me at", "my insta is")
  if (!allowPhone && hasContactIntentPattern(text)) {
    return {
      blocked: true,
      reason: "contact_intent_detected",
      userMessage: `Your ${fieldName} appears to invite off-platform contact. For your safety, all communication should stay within ServiceConnect.`,
      cleanedText: text,
      flags: ["CONTACT_INTENT"],
    };
  }

  // Critical profanity (hate speech / slurs) — block submission entirely
  if (processed.severity === "CRITICAL") {
    return {
      blocked: true,
      reason: "hate_speech_detected",
      userMessage: `Your ${fieldName} contains language that is not permitted on this platform and cannot be submitted.`,
      cleanedText: processed.content,
      flags: processed.filterFlags,
      severity: processed.severity ?? undefined,
    };
  }

  // Severe profanity — block submission
  if (processed.severity === "SEVERE") {
    return {
      blocked: true,
      reason: "profanity_detected",
      userMessage: `Your ${fieldName} contains inappropriate language. Please revise it before submitting.`,
      cleanedText: processed.content,
      flags: processed.filterFlags,
      severity: processed.severity ?? undefined,
    };
  }

  // MILD profanity — allow but return cleaned version
  return {
    blocked: false,
    cleanedText: processed.content,
    flags: processed.filterFlags,
    severity: processed.severity ?? undefined,
  };
}
