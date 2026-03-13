import { Request, Response, NextFunction } from "express";

// Regex patterns for contact info masking
const CONTACT_PATTERNS = [
  { regex: /(\+353[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}|\+353\d{9})/gi, flag: "IE_PHONE" },
  { regex: /(08[3-9][\s\-]?\d{3}[\s\-]?\d{4}|08[3-9]\d{7})/gi, flag: "IE_MOBILE" },
  { regex: /(\+44[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{4}|\+44\d{10})/gi, flag: "UK_PHONE" },
  { regex: /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi, flag: "EMAIL" },
  { regex: /(https?:\/\/[^\s]+)/gi, flag: "URL" },
  { regex: /(www\.[^\s]+\.[^\s]+)/gi, flag: "URL" },
  { regex: /(@[a-zA-Z0-9_]{2,50})/gi, flag: "SOCIAL_HANDLE" },
  { regex: /(\b0\d{9,10}\b)/gi, flag: "PHONE_GENERIC" },
];

const REPLACEMENT = "[contact hidden — upgrade to Standard for full access]";

function containsProfanity(text: string): boolean {
  const badWords = ["fuck", "shit", "damn", "ass", "bitch", "crap"];
  const lower = text.toLowerCase();
  return badWords.some(w => lower.includes(w));
}

export function cleanProfanity(text: string): { cleaned: string; flagged: boolean } {
  if (!text) return { cleaned: text, flagged: false };
  const badWords = ["fuck", "shit", "damn", "bitch", "crap"];
  let cleaned = text;
  let flagged = false;
  for (const word of badWords) {
    const regex = new RegExp(word, 'gi');
    if (regex.test(cleaned)) {
      flagged = true;
      cleaned = cleaned.replace(new RegExp(word, 'gi'), '*'.repeat(word.length));
    }
  }
  return { cleaned, flagged };
}

export function maskContactInfo(text: string): { masked: string; flags: string[]; hitCount: number } {
  if (!text) return { masked: text, flags: [], hitCount: 0 };
  let masked = text;
  const flags: string[] = [];
  let hitCount = 0;

  for (const { regex, flag } of CONTACT_PATTERNS) {
    const matches = masked.match(regex);
    if (matches && matches.length > 0) {
      flags.push(flag);
      hitCount += matches.length;
      masked = masked.replace(regex, REPLACEMENT);
    }
  }

  return { masked, flags, hitCount };
}

export function processMessageContent(
  content: string,
  shouldMaskContacts: boolean
): { content: string; originalContent: string | null; isFiltered: boolean; filterFlags: string[] } {
  const original = content;
  let processed = content;
  const flags: string[] = [];
  let isFiltered = false;

  // Always run profanity filter
  const { cleaned, flagged } = cleanProfanity(processed);
  if (flagged) {
    processed = cleaned;
    flags.push("PROFANITY");
    isFiltered = true;
  }

  // Contact masking for FREE tier pros
  if (shouldMaskContacts) {
    const { masked, flags: contactFlags, hitCount } = maskContactInfo(processed);
    if (hitCount > 0) {
      processed = masked;
      flags.push(...contactFlags);
      isFiltered = true;
    }
  }

  return {
    content: processed,
    originalContent: isFiltered ? original : null,
    isFiltered,
    filterFlags: flags,
  };
}
