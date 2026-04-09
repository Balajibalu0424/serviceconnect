import { processMessageContent } from "./profanityFilter";
import { detectObfuscatedPhone, type ModerationLogEntry } from "./contactDetection";

export interface ModerationOptions {
  /** When true, phone numbers are allowed (STANDARD tier unlock context only) */
  allowPhone?: boolean;
  /** Field name used in user-facing error messages */
  fieldName?: string;
  /** Route/surface for structured logging */
  route?: string;
  /** Surface identifier (chat, job, quote, bio, etc.) */
  surface?: string;
  /** User ID for logging */
  userId?: string;
  /** User role for logging */
  userRole?: string;
  /** Reference ID (conversation, job, etc.) for logging */
  referenceId?: string;
}

export interface ModerationResult {
  blocked: boolean;
  reason?: string;
  userMessage?: string;
  cleanedText: string;
  flags: string[];
  severity?: string;
  /** Structured log entry for admin visibility */
  logEntry?: ModerationLogEntry;
}

// Contact-intent phrases — kept here as a secondary check
const CONTACT_INTENT_PATTERNS: RegExp[] = [
  /(?:reach|find|contact|get|hit)\s+(?:me|us)\s+(?:at|on|via|through|@)/gi,
  /(?:my\s+(?:insta(?:gram)?|snap(?:chat)?|whatsapp|wa|tiktok|twitter|facebook|fb|telegram|signal|viber|number|email|phone|mobile)\s+(?:is|:))/gi,
  /(?:add|follow|dm|message)\s+(?:me|us)\s+(?:on|@)/gi,
  /(?:call|text|ring|phone|whatsapp|message|contact)\s+(?:me|us)\s+(?:on|at)?\s*\d/gi,
  /(?:my\s+(?:number|phone|mobile|cell)\s+(?:is|:))\s*[\d\s\-\.\(\)]{7,}/gi,
  /(?:off\s*(?:the\s+)?(?:app|platform|site))\b/gi,
  /(?:here'?s?\s+(?:my|me)\s+(?:number|phone|details?))\b/gi,
];

function hasContactIntentPattern(text: string): boolean {
  return CONTACT_INTENT_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

// Blocked message constant
const CONTACT_BLOCK_MESSAGE = "Sharing direct contact details is not allowed at this stage of the conversation. Please continue using in-app messaging.";

/**
 * Moderates a text field for profanity and contact information.
 *
 * @param text - The text to moderate
 * @param options - `allowPhone` true only for STANDARD tier unlock contexts
 * @returns ModerationResult — if blocked=true, reject the submission with userMessage
 */
export function moderateText(text: string, options: ModerationOptions = {}): ModerationResult {
  const { allowPhone = false, fieldName = "content", route, surface, userId, userRole, referenceId } = options;

  if (!text || text.trim().length === 0) {
    return { blocked: false, cleanedText: text || "", flags: [] };
  }

  // ── Layer 1: Run profanity + regex contact filter ─────────────────────────
  const processed = processMessageContent(text, !allowPhone);

  // ── Layer 2: Robust obfuscated phone detection ────────────────────────────
  // This catches misspellings, merged words, phonetic tricks, leet, etc.
  const obfuscatedResult = !allowPhone ? detectObfuscatedPhone(text) : null;

  // ── Layer 3: Contact intent phrases ───────────────────────────────────────
  const hasIntent = !allowPhone ? hasContactIntentPattern(text) : false;

  // Build log entry for any detection
  const buildLogEntry = (matchedPatterns: string[], blocked: boolean): ModerationLogEntry => ({
    originalText: text,
    normalizedText: obfuscatedResult?.normalizedText || text.toLowerCase(),
    matchedPatterns,
    reconstructedDigits: obfuscatedResult?.reconstructedDigits || "",
    confidence: obfuscatedResult?.confidence || 0,
    blocked,
    route: route || "unknown",
    surface: surface || fieldName,
    userId,
    userRole,
    referenceId,
  });

  // ── Decision: contact info (regex-based) ──────────────────────────────────
  if (!allowPhone && processed.filterFlags.some(f =>
    f.includes("PHONE") || f.includes("EMAIL") || f.includes("URL") ||
    f.includes("SOCIAL") || f.includes("SPOKEN") || f.includes("MIXED") || f.includes("POSTAL") ||
    f.includes("MESSAGING")
  )) {
    const allFlags = [...processed.filterFlags, ...(obfuscatedResult?.reasons || [])];
    return {
      blocked: true,
      reason: "contact_info_detected",
      userMessage: CONTACT_BLOCK_MESSAGE,
      cleanedText: processed.content,
      flags: allFlags,
      severity: processed.severity ?? undefined,
      logEntry: buildLogEntry(allFlags, true),
    };
  }

  // ── Decision: obfuscated phone number ─────────────────────────────────────
  if (obfuscatedResult && obfuscatedResult.blocked) {
    const allFlags = [...processed.filterFlags, ...obfuscatedResult.reasons];
    return {
      blocked: true,
      reason: "obfuscated_phone_detected",
      userMessage: CONTACT_BLOCK_MESSAGE,
      cleanedText: processed.content,
      flags: allFlags,
      severity: processed.severity ?? undefined,
      logEntry: buildLogEntry(allFlags, true),
    };
  }

  // ── Decision: contact intent with suspicious digit sequence ────────────────
  if (hasIntent && obfuscatedResult && obfuscatedResult.reconstructedDigits.length >= 5) {
    const allFlags = [...processed.filterFlags, ...obfuscatedResult.reasons, "CONTACT_INTENT"];
    return {
      blocked: true,
      reason: "contact_intent_with_digits",
      userMessage: CONTACT_BLOCK_MESSAGE,
      cleanedText: processed.content,
      flags: allFlags,
      severity: processed.severity ?? undefined,
      logEntry: buildLogEntry(allFlags, true),
    };
  }

  // ── Decision: contact intent alone (strong signal) ────────────────────────
  if (hasIntent) {
    const allFlags = [...processed.filterFlags, "CONTACT_INTENT"];
    return {
      blocked: true,
      reason: "contact_intent_detected",
      userMessage: `Your ${fieldName} appears to invite off-platform contact. For your safety, all communication should stay within ServiceConnect.`,
      cleanedText: text,
      flags: allFlags,
      logEntry: buildLogEntry(allFlags, true),
    };
  }

  // ── Decision: Critical profanity (hate speech / slurs) ────────────────────
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

  // ── Decision: Severe profanity ────────────────────────────────────────────
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

  // ── MILD profanity — allow but return cleaned version ─────────────────────
  return {
    blocked: false,
    cleanedText: processed.content,
    flags: processed.filterFlags,
    severity: processed.severity ?? undefined,
  };
}
