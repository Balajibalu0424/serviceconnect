/**
 * contactDetection.ts — Robust layered phone-number and contact-info detection
 *
 * Pipeline:
 *   1. Normalize text (lowercase, strip noise, collapse whitespace)
 *   2. Tokenize
 *   3. Map tokens to digit candidates via fuzzy alias dictionary
 *   4. Decompose merged tokens ("zerosevin" → "zero" + "seven" → "07")
 *   5. Reconstruct digit sequences with gap tolerance
 *   6. Score sequences (length, prefix patterns, contact intent)
 *   7. Return detection result with confidence
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  blocked: boolean;
  confidence: number; // 0–1
  reconstructedDigits: string;
  matchedTokens: string[];
  reasons: string[];
  normalizedText: string;
}

export interface ModerationLogEntry {
  originalText: string;
  normalizedText: string;
  matchedPatterns: string[];
  reconstructedDigits: string;
  confidence: number;
  blocked: boolean;
  route: string;
  surface: string;
  userId?: string;
  userRole?: string;
  referenceId?: string;
}

// ─── FUZZY NUMBER-WORD ALIAS DICTIONARY ─────────────────────────────────────────
// Maps every known variant (misspelling, phonetic, leet, Irish slang) to a digit

const ALIAS_DEFS: [string, string[]][] = [
  ["0", [
    "zero", "oh", "o", "nought", "nil", "zip", "zilch",
    "zer0", "z3ro", "zro", "zer", "zere", "zeroo",
  ]],
  ["1", [
    "one", "won", "wan", "wun", "oen", "1ne", "ine",
    "wone", "onee",
  ]],
  ["2", [
    "two", "too", "to", "tu", "tew", "tw0", "2wo",
    "tow", "twoo", "tue",
  ]],
  ["3", [
    "three", "tree", "tre", "thr33", "thre", "th3ee", "free",
    "thee", "thri", "tri", "trea", "3ee",
  ]],
  ["4", [
    "four", "for", "fore", "foor", "fo", "4our", "foor",
    "foe", "foer", "forr", "fuor", "foir",
  ]],
  ["5", [
    "five", "fiv", "fiv3", "fve", "5ive", "fyve",
    "fife", "fiver",
  ]],
  ["6", [
    "six", "sicks", "s1x", "siz", "6ix", "syx",
    "sicks", "sik", "sixx", "sx",
  ]],
  ["7", [
    "seven", "sevin", "siven", "sevn", "sven", "s3ven", "7even",
    "sevn", "sevan", "sevun", "svn", "sev",
  ]],
  ["8", [
    "eight", "ate", "eit", "ait", "aight", "eigh", "8ight",
    "eit", "acht", "ayght", "eght", "egt",
  ]],
  ["9", [
    "nine", "nein", "nien", "nyne", "9ine", "nin3",
    "nein", "nyne", "nain", "nien",
  ]],
];

// Build forward lookup: alias → digit
const ALIAS_TO_DIGIT = new Map<string, string>();
// Also track all aliases sorted by length descending (for greedy matching)
const ALL_ALIASES_BY_LENGTH: string[] = [];

for (const [digit, aliases] of ALIAS_DEFS) {
  ALIAS_TO_DIGIT.set(digit, digit); // "0" → "0", etc.
  for (const alias of aliases) {
    ALIAS_TO_DIGIT.set(alias.toLowerCase(), digit);
    ALL_ALIASES_BY_LENGTH.push(alias.toLowerCase());
  }
}
ALL_ALIASES_BY_LENGTH.sort((a, b) => b.length - a.length); // longest first

// Multiplier words
const MULTIPLIERS: Record<string, number> = {
  double: 2, dbl: 2, duble: 2, dubble: 2,
  triple: 3, treble: 3, tripl: 3,
};

// Filler / skip words (ignored between number tokens)
const FILLER_WORDS = new Set([
  "and", "then", "by", "comma", "dash", "dot", "point",
  "space", "is", "the", "its", "a", "of", "or",
]);

// Contact-intent phrases
const CONTACT_INTENT_PATTERNS: RegExp[] = [
  /\b(?:call|ring|text|phone|whatsapp|message|contact|reach|hit)\s+(?:me|us)\b/i,
  /\b(?:my|me)\s+(?:number|phone|mobile|cell|digits?)\s+(?:is|:|are)\b/i,
  /\b(?:give|send|dm|msg)\s+(?:me|us|you)\s+(?:a\s+)?(?:call|ring|text|message)\b/i,
  /\b(?:add|follow|find|dm)\s+(?:me|us)\s+(?:on|at|@)\b/i,
  /\b(?:my|the)\s+(?:insta(?:gram)?|snap(?:chat)?|whatsapp|wa|tiktok|twitter|facebook|fb|telegram|signal|viber)\s+(?:is|:)\b/i,
  /\b(?:reach|find|contact|get|hit)\s+(?:me|us)\s+(?:at|on|via|through|outside)\b/i,
  /\b(?:off\s*(?:the\s+)?(?:app|platform|site))\b/i,
  /\b(?:here'?s?\s+(?:my|me)\s+(?:number|phone|details?))\b/i,
];

// ─── STEP 1: NORMALIZATION ──────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  let t = text;

  // Lowercase
  t = t.toLowerCase();

  // Strip zero-width characters and unicode tricks
  t = t.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "");

  // Replace common unicode number lookalikes
  const unicodeDigitMap: Record<string, string> = {
    "\u0660": "0", "\u06F0": "0", // Arabic-Indic
    "\u0661": "1", "\u06F1": "1",
    "\u0662": "2", "\u06F2": "2",
    "\u0663": "3", "\u06F3": "3",
    "\u0664": "4", "\u06F4": "4",
    "\u0665": "5", "\u06F5": "5",
    "\u0666": "6", "\u06F6": "6",
    "\u0667": "7", "\u06F7": "7",
    "\u0668": "8", "\u06F8": "8",
    "\u0669": "9", "\u06F9": "9",
  };
  for (const [uni, dig] of Object.entries(unicodeDigitMap)) {
    t = t.split(uni).join(dig);
  }

  // Normalize common leet substitutions within words (not standalone digits)
  // but carefully — we don't want "1" to become "i" when it's a digit in a sequence
  // We DO want "s3ven" → "seven", "thr33" → "three"
  t = t.replace(/(\D)3(\D)/g, "$1e$2");
  t = t.replace(/^3(\D)/g, "e$1");
  t = t.replace(/(\D)3$/g, "$1e");
  t = t.replace(/(\D)1(\D)/g, "$1i$2");
  t = t.replace(/(\D)0(\D)/g, "$1o$2");

  // Strip characters commonly used as noise between digits/words
  // Replace with space: dashes, dots between words, slashes
  t = t.replace(/[\-\/\\|]+/g, " ");

  // Handle + prefix for international numbers: "+353" → "353"
  t = t.replace(/\+(\d)/g, "$1");

  // Collapse multiple spaces
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

// ─── STEP 2: TOKENIZE ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  // Split on spaces and common separators, keep meaningful tokens
  return text
    .split(/[\s,;:!?()[\]{}"']+/)
    .map(t => t.replace(/^[._]+|[._]+$/g, "")) // strip leading/trailing dots/underscores
    .filter(t => t.length > 0);
}

// ─── STEP 3: DECOMPOSE MERGED TOKENS ────────────────────────────────────────────
// "zerosevin" → ["zero", "sevin"] → ["0", "7"]
// Uses greedy longest-prefix matching against the alias dictionary

function decomposeToken(token: string): string[] {
  // If it's a single digit, return immediately
  if (/^\d$/.test(token)) return [token];

  // If it's a direct alias match, return immediately
  if (ALIAS_TO_DIGIT.has(token)) return [ALIAS_TO_DIGIT.get(token)!];

  // If it's a multi-digit number, return each digit
  if (/^\d+$/.test(token)) return token.split("");

  // If it's a multiplier word, return as-is
  if (MULTIPLIERS[token] !== undefined) return [`*${token}`];

  // If it's a filler word, return skip marker
  if (FILLER_WORDS.has(token)) return ["_SKIP_"];

  // Try greedy decomposition: find longest alias prefix
  const digits: string[] = [];
  let remaining = token;
  let lastWasMatch = false;

  while (remaining.length > 0) {
    let matched = false;

    // Try all aliases, longest first
    for (const alias of ALL_ALIASES_BY_LENGTH) {
      if (remaining.startsWith(alias)) {
        digits.push(ALIAS_TO_DIGIT.get(alias)!);
        remaining = remaining.slice(alias.length);
        matched = true;
        lastWasMatch = true;
        break;
      }
    }

    if (!matched) {
      // Check if remaining starts with a digit
      if (/^\d/.test(remaining)) {
        digits.push(remaining[0]);
        remaining = remaining.slice(1);
        lastWasMatch = true;
      } else {
        // Not a number token — if we already found some digits, break
        // If we haven't found any digits, this token is not a number word
        if (digits.length === 0) {
          return [token]; // return original, not a number token
        }
        // Skip one character and try again (handles noise chars within merged words)
        remaining = remaining.slice(1);
        lastWasMatch = false;
      }
    }
  }

  // Only return digit decomposition if we found enough digits
  // to be meaningful (at least 2), otherwise return original token
  return digits.length >= 2 ? digits : [token];
}

// ─── STEP 4: RECONSTRUCT DIGIT SEQUENCES ────────────────────────────────────────

interface DigitSequence {
  digits: string;
  tokenCount: number;
  gapCount: number;
  startIndex: number;
  matchedTokens: string[];
}

function reconstructSequences(tokens: string[]): DigitSequence[] {
  const sequences: DigitSequence[] = [];
  let currentDigits = "";
  let currentTokenCount = 0;
  let currentGapCount = 0;
  let currentStart = -1;
  let matchedTokens: string[] = [];
  let consecutiveGaps = 0;

  const MAX_CONSECUTIVE_GAPS = 2; // allow up to 2 filler/skip words between numbers

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const decomposed = decomposeToken(token);

    // Check if any part of the decomposition is a digit
    const digitParts = decomposed.filter(d => /^\d$/.test(d));
    const isMultiplier = decomposed.some(d => d.startsWith("*"));
    const isSkip = decomposed.includes("_SKIP_");

    if (digitParts.length > 0) {
      // This token contributes digits
      if (currentStart === -1) currentStart = i;

      // Handle multiplier applied to next/previous digit
      if (isMultiplier && currentDigits.length > 0) {
        const mult = MULTIPLIERS[decomposed.find(d => d.startsWith("*"))!.slice(1)] || 2;
        const lastDigit = currentDigits[currentDigits.length - 1];
        currentDigits += lastDigit.repeat(mult - 1);
      }

      currentDigits += digitParts.join("");
      currentTokenCount += 1;
      matchedTokens.push(token);
      consecutiveGaps = 0;
    } else if (isMultiplier && currentDigits.length > 0) {
      // Multiplier before next digit — mark it, handle when next digit arrives
      // For now, just don't break the sequence
      matchedTokens.push(token);
      consecutiveGaps = 0;
    } else if ((isSkip || FILLER_WORDS.has(token)) && currentDigits.length > 0) {
      // Filler word — allow gap but track it
      consecutiveGaps += 1;
      if (consecutiveGaps <= MAX_CONSECUTIVE_GAPS) {
        currentGapCount += 1;
        continue;
      }
      // Too many consecutive gaps — end sequence
      if (currentDigits.length >= 5) {
        sequences.push({
          digits: currentDigits,
          tokenCount: currentTokenCount,
          gapCount: currentGapCount,
          startIndex: currentStart,
          matchedTokens: [...matchedTokens],
        });
      }
      currentDigits = "";
      currentTokenCount = 0;
      currentGapCount = 0;
      currentStart = -1;
      matchedTokens = [];
      consecutiveGaps = 0;
    } else {
      // Non-digit, non-filler token — end current sequence
      if (currentDigits.length >= 5) {
        sequences.push({
          digits: currentDigits,
          tokenCount: currentTokenCount,
          gapCount: currentGapCount,
          startIndex: currentStart,
          matchedTokens: [...matchedTokens],
        });
      }
      currentDigits = "";
      currentTokenCount = 0;
      currentGapCount = 0;
      currentStart = -1;
      matchedTokens = [];
      consecutiveGaps = 0;
    }
  }

  // Flush remaining
  if (currentDigits.length >= 5) {
    sequences.push({
      digits: currentDigits,
      tokenCount: currentTokenCount,
      gapCount: currentGapCount,
      startIndex: currentStart,
      matchedTokens: [...matchedTokens],
    });
  }

  return sequences;
}

// ─── STEP 5: SCORE SEQUENCES ────────────────────────────────────────────────────

function scoreSequence(seq: DigitSequence, hasContactIntent: boolean): number {
  let score = 0;

  // Base score from length
  if (seq.digits.length >= 10) score += 0.5;
  else if (seq.digits.length >= 7) score += 0.35;
  else if (seq.digits.length >= 5) score += 0.15;

  // Bonus: starts with valid phone prefix
  if (/^08[3-9]/.test(seq.digits)) score += 0.25; // Irish mobile
  if (/^07\d/.test(seq.digits)) score += 0.2; // UK mobile
  if (/^0[12]\d/.test(seq.digits)) score += 0.15; // Irish/UK landline
  if (/^353/.test(seq.digits)) score += 0.25; // Irish intl
  if (/^44/.test(seq.digits)) score += 0.2; // UK intl
  if (/^1\d{3}/.test(seq.digits)) score += 0.1; // US area code

  // Penalty for gaps (obfuscation attempts don't usually have clean speech)
  // Actually, gaps make it MORE suspicious — someone trying to disguise
  if (seq.gapCount > 0 && seq.digits.length >= 7) score += 0.05;

  // Bonus: contact intent in surrounding text
  if (hasContactIntent) score += 0.25;

  // Bonus: high token count means lots of words used for digits (obfuscation signal)
  if (seq.tokenCount >= 7) score += 0.1;

  // Bonus for exact phone number lengths
  if (seq.digits.length === 10 || seq.digits.length === 11) score += 0.1;

  return Math.min(1.0, score);
}

// ─── STEP 6: CONTACT INTENT DETECTION ───────────────────────────────────────────

function detectContactIntent(text: string): boolean {
  return CONTACT_INTENT_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

// ─── MAIN DETECTION FUNCTION ────────────────────────────────────────────────────

const BLOCK_THRESHOLD = 0.4;

export function detectObfuscatedPhone(text: string): DetectionResult {
  if (!text || text.trim().length === 0) {
    return { blocked: false, confidence: 0, reconstructedDigits: "", matchedTokens: [], reasons: [], normalizedText: "" };
  }

  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const hasContactIntent = detectContactIntent(normalized);
  const reasons: string[] = [];

  // Reconstruct digit sequences
  const sequences = reconstructSequences(tokens);

  if (sequences.length === 0 && !hasContactIntent) {
    return { blocked: false, confidence: 0, reconstructedDigits: "", matchedTokens: [], reasons: [], normalizedText: normalized };
  }

  // Find the highest-scoring sequence
  let bestScore = 0;
  let bestSeq: DigitSequence | null = null;

  for (const seq of sequences) {
    const score = scoreSequence(seq, hasContactIntent);
    if (score > bestScore) {
      bestScore = score;
      bestSeq = seq;
    }
  }

  // Build reasons
  if (bestSeq) {
    if (bestSeq.digits.length >= 10) reasons.push("PHONE_LENGTH_MATCH");
    else if (bestSeq.digits.length >= 7) reasons.push("PARTIAL_PHONE_MATCH");
    else reasons.push("SHORT_DIGIT_SEQUENCE");

    if (/^08[3-9]/.test(bestSeq.digits)) reasons.push("IRISH_MOBILE_PREFIX");
    if (/^07\d/.test(bestSeq.digits)) reasons.push("UK_MOBILE_PREFIX");
    if (/^353/.test(bestSeq.digits)) reasons.push("IRISH_INTL_PREFIX");

    if (bestSeq.gapCount > 0) reasons.push("GAP_OBFUSCATION");
    if (bestSeq.tokenCount > bestSeq.digits.length * 0.5) reasons.push("WORD_BASED_OBFUSCATION");
  }

  if (hasContactIntent) reasons.push("CONTACT_INTENT");

  // Contact intent alone with a short sequence can be suspicious
  if (hasContactIntent && bestSeq && bestSeq.digits.length >= 5) {
    bestScore = Math.max(bestScore, 0.45);
  }

  const blocked = bestScore >= BLOCK_THRESHOLD;

  return {
    blocked,
    confidence: bestScore,
    reconstructedDigits: bestSeq?.digits || "",
    matchedTokens: bestSeq?.matchedTokens || [],
    reasons,
    normalizedText: normalized,
  };
}

// ─── CONVENIENCE: Check any text for contact sharing ────────────────────────────

export function isContactSharingAttempt(text: string): {
  blocked: boolean;
  confidence: number;
  reasons: string[];
  details: DetectionResult;
} {
  const result = detectObfuscatedPhone(text);
  return {
    blocked: result.blocked,
    confidence: result.confidence,
    reasons: result.reasons,
    details: result,
  };
}
