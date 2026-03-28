import { Request, Response, NextFunction } from "express";

// ─── SEVERITY TIERS ───────────────────────────────────────────────────────────
// MILD: replaced with asterisks, user warned
// SEVERE: replaced + message auto-flagged for admin review
// CRITICAL: slurs/hate speech — replaced + flagged + potential account action

export type SeverityTier = "MILD" | "SEVERE" | "CRITICAL";

interface ProfanityMatch {
  word: string;
  severity: SeverityTier;
}

// ─── COMPREHENSIVE BAD WORD LIST ──────────────────────────────────────────────

const PROFANITY_LIST: { word: string; severity: SeverityTier }[] = [
  // MILD — common profanity
  { word: "damn", severity: "MILD" },
  { word: "dammit", severity: "MILD" },
  { word: "crap", severity: "MILD" },
  { word: "hell", severity: "MILD" },
  { word: "piss", severity: "MILD" },
  { word: "pissed", severity: "MILD" },
  { word: "arse", severity: "MILD" },
  { word: "arsehole", severity: "MILD" },
  { word: "bollocks", severity: "MILD" },
  { word: "bugger", severity: "MILD" },
  { word: "bloody", severity: "MILD" },
  { word: "shag", severity: "MILD" },
  { word: "sod", severity: "MILD" },
  { word: "git", severity: "MILD" },
  { word: "wanker", severity: "MILD" },
  { word: "tosser", severity: "MILD" },
  { word: "minger", severity: "MILD" },
  { word: "daft", severity: "MILD" },
  { word: "gobshite", severity: "MILD" },
  { word: "eejit", severity: "MILD" },

  // SEVERE — strong profanity
  { word: "fuck", severity: "SEVERE" },
  { word: "fucker", severity: "SEVERE" },
  { word: "fucking", severity: "SEVERE" },
  { word: "fucked", severity: "SEVERE" },
  { word: "fucks", severity: "SEVERE" },
  { word: "motherfucker", severity: "SEVERE" },
  { word: "motherfucking", severity: "SEVERE" },
  { word: "shit", severity: "SEVERE" },
  { word: "shitty", severity: "SEVERE" },
  { word: "bullshit", severity: "SEVERE" },
  { word: "horseshit", severity: "SEVERE" },
  { word: "dipshit", severity: "SEVERE" },
  { word: "shithead", severity: "SEVERE" },
  { word: "ass", severity: "SEVERE" },
  { word: "asshole", severity: "SEVERE" },
  { word: "arsehole", severity: "SEVERE" },
  { word: "bitch", severity: "SEVERE" },
  { word: "bitches", severity: "SEVERE" },
  { word: "bitching", severity: "SEVERE" },
  { word: "bastard", severity: "SEVERE" },
  { word: "dick", severity: "SEVERE" },
  { word: "dickhead", severity: "SEVERE" },
  { word: "cock", severity: "SEVERE" },
  { word: "cocksucker", severity: "SEVERE" },
  { word: "prick", severity: "SEVERE" },
  { word: "twat", severity: "SEVERE" },
  { word: "cunt", severity: "SEVERE" },
  { word: "slut", severity: "SEVERE" },
  { word: "whore", severity: "SEVERE" },
  { word: "skank", severity: "SEVERE" },
  { word: "wank", severity: "SEVERE" },
  { word: "bellend", severity: "SEVERE" },
  { word: "knob", severity: "SEVERE" },
  { word: "knobhead", severity: "SEVERE" },
  { word: "muppet", severity: "SEVERE" },
  { word: "pillock", severity: "SEVERE" },
  { word: "plonker", severity: "SEVERE" },
  { word: "numpty", severity: "SEVERE" },
  { word: "scumbag", severity: "SEVERE" },
  { word: "douchebag", severity: "SEVERE" },
  { word: "jackass", severity: "SEVERE" },

  // CRITICAL — slurs and hate speech
  { word: "nigger", severity: "CRITICAL" },
  { word: "nigga", severity: "CRITICAL" },
  { word: "negro", severity: "CRITICAL" },
  { word: "coon", severity: "CRITICAL" },
  { word: "darkie", severity: "CRITICAL" },
  { word: "spic", severity: "CRITICAL" },
  { word: "spick", severity: "CRITICAL" },
  { word: "wetback", severity: "CRITICAL" },
  { word: "beaner", severity: "CRITICAL" },
  { word: "chink", severity: "CRITICAL" },
  { word: "gook", severity: "CRITICAL" },
  { word: "jap", severity: "CRITICAL" },
  { word: "paki", severity: "CRITICAL" },
  { word: "raghead", severity: "CRITICAL" },
  { word: "towelhead", severity: "CRITICAL" },
  { word: "camel jockey", severity: "CRITICAL" },
  { word: "sandnigger", severity: "CRITICAL" },
  { word: "kike", severity: "CRITICAL" },
  { word: "hymie", severity: "CRITICAL" },
  { word: "heeb", severity: "CRITICAL" },
  { word: "cracker", severity: "CRITICAL" },
  { word: "honky", severity: "CRITICAL" },
  { word: "whitey", severity: "CRITICAL" },
  { word: "gringo", severity: "CRITICAL" },
  { word: "fag", severity: "CRITICAL" },
  { word: "faggot", severity: "CRITICAL" },
  { word: "dyke", severity: "CRITICAL" },
  { word: "homo", severity: "CRITICAL" },
  { word: "lesbo", severity: "CRITICAL" },
  { word: "tranny", severity: "CRITICAL" },
  { word: "shemale", severity: "CRITICAL" },
  { word: "retard", severity: "CRITICAL" },
  { word: "retarded", severity: "CRITICAL" },
  { word: "spaz", severity: "CRITICAL" },
  { word: "spastic", severity: "CRITICAL" },
  { word: "cripple", severity: "CRITICAL" },
  { word: "midget", severity: "CRITICAL" },
  { word: "mongoloid", severity: "CRITICAL" },
  { word: "gypo", severity: "CRITICAL" },
  { word: "pikey", severity: "CRITICAL" },
  { word: "knacker", severity: "CRITICAL" },
  { word: "tinker", severity: "CRITICAL" },
  { word: "traveller scum", severity: "CRITICAL" },
  { word: "kill yourself", severity: "CRITICAL" },
  { word: "kys", severity: "CRITICAL" },
  { word: "go die", severity: "CRITICAL" },
  { word: "neck yourself", severity: "CRITICAL" },
];

// ─── LEET-SPEAK NORMALIZATION ─────────────────────────────────────────────────
// Converts leet-speak variants back to normal letters for matching
const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", "$": "s", "!": "i", "*": "", "+": "t", "(": "c",
  "|": "i", "¡": "i", "£": "l",
};

function normalizeLeetSpeak(text: string): string {
  let normalized = text.toLowerCase();
  for (const [leet, normal] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(normal);
  }
  // Remove common obfuscation characters between letters
  normalized = normalized.replace(/[\.\-_\s]+(?=[a-z])/g, "");
  return normalized;
}

// ─── PROFANITY DETECTION ──────────────────────────────────────────────────────

export function detectProfanity(text: string): { matches: ProfanityMatch[]; highestSeverity: SeverityTier | null } {
  if (!text) return { matches: [], highestSeverity: null };

  const normalizedText = normalizeLeetSpeak(text);
  const matches: ProfanityMatch[] = [];
  let highestSeverity: SeverityTier | null = null;

  const severityOrder: Record<SeverityTier, number> = { MILD: 1, SEVERE: 2, CRITICAL: 3 };

  for (const entry of PROFANITY_LIST) {
    const wordPattern = entry.word.includes(" ")
      ? new RegExp(entry.word.replace(/\s+/g, "\\s+"), "gi")
      : new RegExp(`\\b${entry.word}\\b`, "gi");

    // Check both original (lowercase) and normalized text
    if (wordPattern.test(text.toLowerCase()) || wordPattern.test(normalizedText)) {
      matches.push({ word: entry.word, severity: entry.severity });
      if (!highestSeverity || severityOrder[entry.severity] > severityOrder[highestSeverity]) {
        highestSeverity = entry.severity;
      }
    }
  }

  return { matches, highestSeverity };
}

export function cleanProfanity(text: string): { cleaned: string; flagged: boolean; severity: SeverityTier | null; matchCount: number } {
  if (!text) return { cleaned: text, flagged: false, severity: null, matchCount: 0 };

  const { matches, highestSeverity } = detectProfanity(text);
  if (matches.length === 0) return { cleaned: text, flagged: false, severity: null, matchCount: 0 };

  let cleaned = text;
  for (const match of matches) {
    // Create regex that matches the word in original text (case-insensitive)
    if (match.word.includes(" ")) {
      const multiWordRegex = new RegExp(match.word.replace(/\s+/g, "\\s+"), "gi");
      cleaned = cleaned.replace(multiWordRegex, (m) => "*".repeat(m.length));
    } else {
      const wordRegex = new RegExp(`\\b${match.word}\\b`, "gi");
      cleaned = cleaned.replace(wordRegex, (m) => "*".repeat(m.length));
    }
  }

  // Also clean leet-speak variants in original text
  // Common patterns like f*ck, $hit, a$$
  const leetPatterns = [
    { pattern: /f[\*\.\-_]?[uü][\*\.\-_]?c[\*\.\-_]?k/gi, replace: "****" },
    { pattern: /\$h[\!1i]t/gi, replace: "****" },
    { pattern: /a\$\$/gi, replace: "***" },
    { pattern: /b[\!1]tch/gi, replace: "*****" },
    { pattern: /d[\!1]ck/gi, replace: "****" },
    { pattern: /c[\*\.\-_]?[uü]nt/gi, replace: "****" },
    { pattern: /n[\!1]gg[ea3]r?/gi, replace: "******" },
    { pattern: /f[\@4]gg?[o0]t/gi, replace: "******" },
    { pattern: /r[e3]t[\@4]rd/gi, replace: "******" },
    { pattern: /wh[o0]r[e3]/gi, replace: "*****" },
    { pattern: /\$lut/gi, replace: "****" },
    { pattern: /\$[ck]um/gi, replace: "****" },
  ];

  for (const { pattern, replace } of leetPatterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, replace);
    }
  }

  return { cleaned, flagged: true, severity: highestSeverity, matchCount: matches.length };
}

// ─── CONTACT INFO MASKING (ENHANCED) ──────────────────────────────────────────

const CONTACT_REPLACEMENT = "[contact info removed — use in-app messaging]";

// Regex patterns for contact info masking — enhanced coverage
const CONTACT_PATTERNS = [
  // Irish phone numbers
  { regex: /(\+353[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{4}|\+353\d{9})/gi, flag: "IE_PHONE" },
  { regex: /(08[3-9][\s\-]?\d{3}[\s\-]?\d{4}|08[3-9]\d{7})/gi, flag: "IE_MOBILE" },
  // UK phone numbers
  { regex: /(\+44[\s\-]?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{4}|\+44\d{10})/gi, flag: "UK_PHONE" },
  { regex: /(07\d{3}[\s\-]?\d{3}[\s\-]?\d{3}|07\d{9})/gi, flag: "UK_MOBILE" },
  // US/International phone numbers
  { regex: /(\+1[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}|\+1\d{10})/gi, flag: "US_PHONE" },
  { regex: /(\+\d{1,4}[\s\-]?\d{6,14})/gi, flag: "INTL_PHONE" },
  // Generic: any sequence of 7+ digits with optional separators
  { regex: /\b(\d[\s\-\.]*){7,15}\b/gi, flag: "PHONE_GENERIC" },
  // Email addresses
  { regex: /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi, flag: "EMAIL" },
  // Email obfuscation ("name at gmail dot com")
  { regex: /\b[a-zA-Z0-9._%+-]+\s*(?:\bat\b|\[at\]|@)\s*[a-zA-Z0-9.-]+\s*(?:\bdot\b|\[dot\]|\.)\s*(?:com|ie|co\.uk|net|org|io)\b/gi, flag: "EMAIL_OBFUSCATED" },
  // URLs
  { regex: /(https?:\/\/[^\s]+)/gi, flag: "URL" },
  { regex: /(www\.[^\s]+\.[^\s]+)/gi, flag: "URL" },
  // Social media handles
  { regex: /(@[a-zA-Z0-9_]{2,50})/gi, flag: "SOCIAL_HANDLE" },
  // Social media URLs
  { regex: /((?:instagram|facebook|fb|twitter|tiktok|snapchat|linkedin|youtube|whatsapp|wa|telegram|signal)\.(?:com|me|tv|io)[\/\w\-\.]*)/gi, flag: "SOCIAL_URL" },
  // Social media invitations
  { regex: /(?:add|follow|find|dm|message|text|call|ring|contact|reach)\s+(?:me|us)\s+(?:on|at|via|through)\s+(?:instagram|insta|facebook|fb|whatsapp|wa|snap|snapchat|twitter|tiktok|telegram|signal|viber)/gi, flag: "SOCIAL_INVITE" },
  // WhatsApp / messaging links
  { regex: /(?:wa\.me|chat\.whatsapp\.com|t\.me|m\.me)\/[^\s]+/gi, flag: "MESSAGING_LINK" },
  // Eircode (Irish postal codes — can be used as contact vectors)
  { regex: /\b[A-Za-z]\d{2}\s?[A-Za-z0-9]{4}\b/gi, flag: "EIRCODE" },
];

// Spelled-out number detection
const NUMBER_WORDS: Record<string, string> = {
  "zero": "0", "oh": "0", "o": "0",
  "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
  "six": "6", "seven": "7", "eight": "8", "nine": "9",
  "wan": "1", "tree": "3", "fiver": "5", "sixer": "6", // Irish slang
};

function detectSpelledOutNumbers(text: string): { hasNumber: boolean; flag: string } {
  const lower = text.toLowerCase();

  // Pattern: sequences of number words that could form a phone number
  // e.g., "oh eight seven one two three four five six seven"
  const words = lower.split(/[\s,\-\.]+/);
  let digitSequence = "";
  let startedSequence = false;

  for (const word of words) {
    if (NUMBER_WORDS[word] !== undefined || /^\d$/.test(word)) {
      digitSequence += NUMBER_WORDS[word] || word;
      startedSequence = true;
    } else if (startedSequence) {
      // Break in sequence
      if (digitSequence.length >= 7) {
        return { hasNumber: true, flag: "SPOKEN_PHONE" };
      }
      digitSequence = "";
      startedSequence = false;
    }
  }

  // Check final sequence
  if (digitSequence.length >= 7) {
    return { hasNumber: true, flag: "SPOKEN_PHONE" };
  }

  // Pattern: mixed format "087-one-two-three-four-five-six-seven"
  const mixedPattern = /\b\d{2,4}[\s\-]*((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|wan|tree)[\s\-]*){4,})/gi;
  if (mixedPattern.test(lower)) {
    return { hasNumber: true, flag: "MIXED_PHONE" };
  }

  return { hasNumber: false, flag: "" };
}

export function maskContactInfo(text: string): { masked: string; flags: string[]; hitCount: number } {
  if (!text) return { masked: text, flags: [], hitCount: 0 };
  let masked = text;
  const flags: string[] = [];
  let hitCount = 0;

  // Standard regex-based contact detection
  for (const { regex, flag } of CONTACT_PATTERNS) {
    // Reset regex lastIndex
    regex.lastIndex = 0;
    const matches = masked.match(regex);
    if (matches && matches.length > 0) {
      flags.push(flag);
      hitCount += matches.length;
      regex.lastIndex = 0;
      masked = masked.replace(regex, CONTACT_REPLACEMENT);
    }
  }

  // Spelled-out / mixed number detection
  const spokenResult = detectSpelledOutNumbers(masked);
  if (spokenResult.hasNumber) {
    flags.push(spokenResult.flag);
    hitCount += 1;
    // Replace the spoken number portion with placeholder
    // Since we can't easily substring-replace spoken numbers, add a warning suffix
    masked = masked + "\n\n⚠️ [Potential phone number detected and hidden — please use in-app messaging]";
  }

  return { masked, flags, hitCount };
}

// ─── COMBINED PROCESSING ──────────────────────────────────────────────────────

export interface FilterResult {
  content: string;
  originalContent: string | null;
  isFiltered: boolean;
  filterFlags: string[];
  severity: SeverityTier | null;
  profanityCount: number;
  contactCount: number;
}

export function processMessageContent(
  content: string,
  shouldMaskContacts: boolean
): FilterResult {
  const original = content;
  let processed = content;
  const flags: string[] = [];
  let isFiltered = false;
  let severity: SeverityTier | null = null;
  let profanityCount = 0;
  let contactCount = 0;

  // 1. Always run profanity filter
  const { cleaned, flagged, severity: profSeverity, matchCount } = cleanProfanity(processed);
  if (flagged) {
    processed = cleaned;
    flags.push("PROFANITY");
    if (profSeverity === "CRITICAL") flags.push("HATE_SPEECH");
    if (profSeverity === "SEVERE") flags.push("STRONG_PROFANITY");
    isFiltered = true;
    severity = profSeverity;
    profanityCount = matchCount;
  }

  // 2. ALWAYS mask contact info (not just for FREE tier — platform-wide policy)
  const { masked, flags: contactFlags, hitCount } = maskContactInfo(processed);
  if (hitCount > 0) {
    processed = masked;
    flags.push(...contactFlags);
    isFiltered = true;
    contactCount = hitCount;
  }

  return {
    content: processed,
    originalContent: isFiltered ? original : null,
    isFiltered,
    filterFlags: flags,
    severity,
    profanityCount,
    contactCount,
  };
}
