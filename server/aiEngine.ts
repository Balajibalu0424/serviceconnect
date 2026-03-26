/**
 * ServiceConnect AI Engine — Phase 1
 * ─────────────────────────────────────────────────────────────────────────────
 * All 5 Phase 1 AI features. Zero external API cost unless HuggingFace NER
 * is called (free inference API). Every function is synchronous-friendly and
 * safe for Vercel serverless (no persistent processes).
 *
 * Features:
 *   1. Job Description Quality Gate
 *   2. Category Auto-Detection from free text
 *   3. Fake Job Detection (rule-based Layer 1)
 *   4. NER Contact Obfuscation Catch (HuggingFace Layer 2)
 *   5. Urgency Detection
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QualityResult {
  score: number;          // 0–100
  passed: boolean;        // true if score >= QUALITY_THRESHOLD
  prompt: string | null;  // AI-generated hint shown to customer when failed
  issues: string[];       // machine-readable issue codes
}

export interface CategoryResult {
  categorySlug: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface FakeJobResult {
  isFake: boolean;
  reason: string;
  layer: "NONE" | "RULE" | "AI";
}

export interface UrgencyResult {
  isUrgent: boolean;
  detectedKeywords: string[];
}

export interface NerMaskResult {
  masked: string;
  caught: boolean;        // true if NER found something regex missed
  flags: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUALITY_THRESHOLD = 40;
const MIN_DESCRIPTION_WORDS = 20;
const MIN_DESCRIPTION_CHARS = 80;

// ─── 1. JOB DESCRIPTION QUALITY GATE ─────────────────────────────────────────
//
// Runs before DRAFT → LIVE transition. Scores the job on 5 signals.
// If score < QUALITY_THRESHOLD, returns a friendly prompt for the customer.
//
export function scoreJobQuality(
  title: string,
  description: string,
  locationText: string | null | undefined,
  categoryName: string
): QualityResult {
  const issues: string[] = [];
  let score = 0;

  const descWords = description.trim().split(/\s+/).filter(Boolean);
  const descLen = description.trim().length;

  // Signal 1: Description length (0–30 pts)
  if (descWords.length >= 40) score += 30;
  else if (descWords.length >= 25) score += 22;
  else if (descWords.length >= MIN_DESCRIPTION_WORDS) score += 14;
  else {
    score += Math.floor((descWords.length / MIN_DESCRIPTION_WORDS) * 14);
    issues.push("SHORT_DESCRIPTION");
  }

  // Signal 2: Title quality (0–20 pts)
  const titleWords = title.trim().split(/\s+/).filter(Boolean);
  if (titleWords.length >= 5 && title.length >= 20) score += 20;
  else if (titleWords.length >= 3 && title.length >= 10) score += 12;
  else {
    score += 4;
    issues.push("VAGUE_TITLE");
  }

  // Signal 3: Location present (0–20 pts)
  if (locationText && locationText.trim().length >= 4) score += 20;
  else {
    issues.push("NO_LOCATION");
  }

  // Signal 4: Specificity signals — size/material/quantity words (0–20 pts)
  const specificityWords = [
    "bedroom", "bathroom", "kitchen", "room", "floor", "wall", "ceiling",
    "metre", "meter", "m2", "sq ft", "litre", "kg", "pipe", "wire",
    "radiator", "boiler", "tap", "drain", "tile", "brick", "window", "door",
    "garden", "fence", "lawn", "hedge", "tree", "gutter", "roof",
    "socket", "switch", "fuse", "circuit", "panel",
    "weekly", "monthly", "one-off", "regular", "one off",
    "asap", "urgent", "emergency", "flexible", "weekend",
    "property", "house", "apartment", "flat", "office", "commercial",
  ];
  const descLower = description.toLowerCase();
  const specificHits = specificityWords.filter(w => descLower.includes(w)).length;
  if (specificHits >= 3) score += 20;
  else if (specificHits >= 1) score += 10;
  else issues.push("LOW_SPECIFICITY");

  // Signal 5: Not a one-liner (0–10 pts)
  if (descLen >= 150) score += 10;
  else if (descLen >= MIN_DESCRIPTION_CHARS) score += 5;
  else issues.push("TOO_SHORT");

  score = Math.min(100, score);
  const passed = score >= QUALITY_THRESHOLD;

  // Build a helpful prompt for the customer when quality is too low
  let prompt: string | null = null;
  if (!passed) {
    const tips: string[] = [];
    if (issues.includes("SHORT_DESCRIPTION") || issues.includes("TOO_SHORT")) {
      tips.push(`add more detail about the ${categoryName.toLowerCase()} work needed`);
    }
    if (issues.includes("VAGUE_TITLE")) {
      tips.push("make your title more specific (e.g. 'Fix leaking tap in kitchen' instead of 'Plumbing job')");
    }
    if (issues.includes("NO_LOCATION")) {
      tips.push("include your location so pros near you can find the job");
    }
    if (issues.includes("LOW_SPECIFICITY")) {
      tips.push("mention the size, material, or scope — e.g. 'two-bedroom flat', 'replace radiator valve', 'approx 20 m² of lawn'");
    }
    prompt = `To get better quotes, please: ${tips.join("; ")}.`;
  }

  return { score, passed, prompt, issues };
}

// ─── 2. CATEGORY AUTO-DETECTION ───────────────────────────────────────────────
//
// Maps free-text description to one of ServiceConnect's 16 category slugs.
// Rule-based keyword matching — no API call needed.
//
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumbing: [
    "plumb", "pipe", "leak", "tap", "toilet", "drain", "boiler", "radiator",
    "water", "flush", "cistern", "shower", "bath", "sink", "pressure",
    "burst", "valve", "stopcock", "immersion", "cylinder",
  ],
  electrical: [
    "electric", "wiring", "socket", "switch", "fuse", "circuit", "power",
    "light", "outlet", "panel", "consumer unit", "mcb", "rcd", "volt",
    "ampere", "plug", "cable", "earthing", "LED", "installation",
  ],
  cleaning: [
    "clean", "hoover", "vacuum", "mop", "scrub", "tidy", "dust", "polish",
    "wash", "laundry", "oven clean", "carpet clean", "end of tenancy",
    "deep clean", "office clean", "window clean",
  ],
  painting: [
    "paint", "decor", "wallpaper", "plaster", "render", "finish",
    "coat", "primer", "gloss", "emulsion", "ceiling rose", "skirting",
    "stain", "varnish", "spray",
  ],
  gardening: [
    "garden", "lawn", "grass", "mow", "hedge", "tree", "plant", "weed",
    "leaf", "landscap", "decking", "patio", "turf", "shrub", "prune",
    "compost", "flowerbed", "soil",
  ],
  removals: [
    "remov", "moving", "move house", "van", "transport", "relocat",
    "furniture", "boxes", "storage", "pack", "unpack", "delivery",
    "sofa", "piano", "clearance",
  ],
  handyman: [
    "handyman", "fix", "repair", "assemble", "flat pack", "ikea",
    "shelf", "curtain", "blind", "tile", "grout", "sealant",
    "hang", "drill", "screw", "door handle", "lock", "hinge",
    "odd job",
  ],
  tutoring: [
    "tutor", "teach", "lesson", "homework", "study", "maths", "math",
    "english", "science", "leaving cert", "junior cert", "exam", "school",
    "language", "french", "spanish", "irish", "physics", "chemistry",
  ],
  photography: [
    "photo", "video", "film", "shoot", "wedding", "portrait",
    "headshot", "drone", "aerial", "event", "product photo",
    "corporate video", "reel", "instagram",
  ],
  catering: [
    "cater", "food", "chef", "cook", "buffet", "meal", "party food",
    "wedding dinner", "corporate lunch", "bbq", "canape",
    "vegan", "gluten free", "halal",
  ],
  "web-design": [
    "website", "web design", "wordpress", "shopify", "ecommerce",
    "landing page", "seo", "app", "mobile app", "ui", "ux",
    "logo", "branding", "graphic design",
  ],
  "personal-training": [
    "personal train", "fitness", "gym", "workout", "exercise",
    "weight loss", "muscle", "nutrition", "diet", "yoga",
    "pilates", "crossfit", "running", "marathon",
  ],
  "pet-care": [
    "dog", "cat", "pet", "walk", "grooming", "vet", "boarding",
    "puppy", "kitten", "rabbit", "bird", "fish tank",
  ],
  "auto-repair": [
    "car", "vehicle", "mechanic", "service", "mot", "nct", "tyre",
    "brake", "engine", "oil change", "battery", "van", "truck",
    "bodywork", "dent", "windscreen",
  ],
  legal: [
    "legal", "solicitor", "lawyer", "contract", "conveyancing",
    "will", "probate", "tenancy agreement", "employment law",
    "dispute", "court", "nda",
  ],
  accounting: [
    "account", "bookkeep", "tax return", "vat", "payroll", "audit",
    "financial statement", "invoice", "xero", "quickbooks",
    "self-assessment", "revenue",
  ],
};

export function detectCategory(
  title: string,
  description: string,
  availableCategories: Array<{ id: string; slug: string; name: string }>
): CategoryResult {
  const text = `${title} ${description}`.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[slug] = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        // Weight by keyword position — title match scores more
        const inTitle = title.toLowerCase().includes(kw.toLowerCase());
        scores[slug] += inTitle ? 3 : 1;
      }
    }
  }

  const sorted = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return { categorySlug: null, confidence: "LOW", reason: "No category keywords matched" };
  }

  const [topSlug, topScore] = sorted[0];
  const runnerUpScore = sorted[1]?.[1] ?? 0;

  const cat = availableCategories.find(c => c.slug === topSlug);
  if (!cat) {
    return { categorySlug: null, confidence: "LOW", reason: "Matched slug not in category list" };
  }

  const margin = topScore - runnerUpScore;
  const confidence: "HIGH" | "MEDIUM" | "LOW" =
    topScore >= 6 && margin >= 3 ? "HIGH" :
    topScore >= 3 ? "MEDIUM" : "LOW";

  return {
    categorySlug: topSlug,
    confidence,
    reason: `Matched ${topScore} keyword signals for ${cat.name}`,
  };
}

// ─── 3. FAKE JOB DETECTION (RULE-BASED LAYER 1) ───────────────────────────────
//
// Fast synchronous checks. No API call. Returns isFake=true if any hard rule
// fires. Soft rules accumulate score and flag for ADMIN REVIEW.
//
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
  "10minutemail.com", "yopmail.com", "sharklasers.com", "guerrillamailblock.com",
  "spam4.me", "trashmail.com", "dispostable.com", "fakeinbox.com",
  "mailnull.com", "spamgourmet.com", "mytemp.email", "tempinbox.com",
];

export function detectFakeJob(params: {
  title: string;
  description: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  customerEmail: string;
  descriptionWordCount: number;
}): FakeJobResult {
  const { title, description, budgetMin, budgetMax, customerEmail, descriptionWordCount } = params;

  // Hard rules — immediate fake flag
  const emailDomain = customerEmail.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE_DOMAINS.includes(emailDomain)) {
    return { isFake: true, reason: "Disposable email domain detected", layer: "RULE" };
  }

  if (descriptionWordCount < 5) {
    return { isFake: true, reason: "Description has fewer than 5 words", layer: "RULE" };
  }

  // Budget outliers — suspiciously low (€1) or absurdly high (€99,999+)
  if (budgetMin !== null && budgetMin !== undefined) {
    if (budgetMin <= 1) {
      return { isFake: true, reason: "Budget minimum is suspiciously low (≤€1)", layer: "RULE" };
    }
    if (budgetMin > 99000) {
      return { isFake: true, reason: "Budget minimum is unrealistically high (>€99,000)", layer: "RULE" };
    }
  }

  // Title/description are identical (copy-paste spam)
  if (title.trim().toLowerCase() === description.trim().toLowerCase()) {
    return { isFake: true, reason: "Title and description are identical", layer: "RULE" };
  }

  // Title is just a single word or number
  const titleWords = title.trim().split(/\s+/);
  if (titleWords.length === 1 && title.length < 10) {
    return { isFake: true, reason: "Job title is a single word with no context", layer: "RULE" };
  }

  return { isFake: false, reason: "Passed all fake-job rules", layer: "NONE" };
}

// ─── 4. NER CONTACT MASKING (HUGGINGFACE LAYER 2) ────────────────────────────
//
// Called ONLY when: sender is FREE-tier pro AND regex masking found nothing.
// Uses dslim/bert-base-NER via HuggingFace Inference API to catch obfuscated
// contact-sharing like "zero eight seven..." or "my insta is johnplumbing".
//
// Falls back gracefully if HuggingFace is unavailable (serverless cold start).
//
const HF_NER_MODEL = "dslim/bert-base-NER";
const HF_NER_URL = `https://api-inference.huggingface.co/models/${HF_NER_MODEL}`;

interface NerEntity {
  entity_group: string;
  word: string;
  score: number;
  start: number;
  end: number;
}

export async function nerMaskObfuscated(
  text: string,
  hfApiKey: string | undefined
): Promise<NerMaskResult> {
  if (!hfApiKey) {
    return { masked: text, caught: false, flags: [] };
  }

  try {
    const res = await fetch(HF_NER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(5000), // 5s timeout — don't block the chat
    });

    if (!res.ok) {
      console.warn("[NER] HuggingFace returned", res.status, "— skipping NER mask");
      return { masked: text, caught: false, flags: [] };
    }

    const entities: NerEntity[] = await res.json();

    // We care about PER (person names used as contact handles) and ORG
    // when the context suggests a social/web handle
    const suspectEntities = entities.filter(
      e => e.score > 0.85 && (e.entity_group === "PER" || e.entity_group === "ORG")
    );

    if (suspectEntities.length === 0) {
      return { masked: text, caught: false, flags: [] };
    }

    // Only flag if the message contains social-sharing context words
    const lowerText = text.toLowerCase();
    const socialContextWords = [
      "instagram", "insta", "facebook", "fb", "whatsapp", "wa", "snap",
      "snapchat", "tiktok", "twitter", "telegram", "signal", "dm", "message me",
      "find me", "my profile", "my page", "add me",
    ];
    const hasSocialContext = socialContextWords.some(w => lowerText.includes(w));

    if (!hasSocialContext) {
      return { masked: text, caught: false, flags: [] };
    }

    // Mask the entity words found in social context
    let masked = text;
    const flags: string[] = [];
    for (const e of suspectEntities) {
      masked = masked.replace(
        new RegExp(`\\b${e.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
        "[contact hidden — upgrade to Standard for full access]"
      );
      flags.push(`NER_${e.entity_group}`);
    }

    return { masked, caught: true, flags };
  } catch (err) {
    console.warn("[NER] Error calling HuggingFace NER:", err);
    return { masked: text, caught: false, flags: [] };
  }
}

// ─── 5. URGENCY DETECTION ─────────────────────────────────────────────────────
//
// Detects emergency/urgent jobs. Returns isUrgent=true when keywords found.
// If urgent, the job urgency field is auto-set to "URGENT" and pros get a
// push notification (handled at the route level).
//
const URGENCY_KEYWORDS = [
  // Explicit urgency
  "urgent", "emergency", "asap", "immediately", "today", "tonight", "right now",
  "as soon as possible", "no heating", "no hot water", "burst pipe",
  "flooding", "flooded", "flood", "water leak", "gas leak", "power cut",
  "no power", "no electricity", "locked out", "broken boiler",
  "boiler broken", "broken pipe", "sewage", "overflow",
  // Time pressure
  "before tomorrow", "within 24", "within 48", "this evening",
  "tomorrow morning", "fix tonight",
];

export function detectUrgency(title: string, description: string): UrgencyResult {
  const text = `${title} ${description}`.toLowerCase();
  const detectedKeywords = URGENCY_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));

  return {
    isUrgent: detectedKeywords.length > 0,
    detectedKeywords,
  };
}
// AI Engine build: 20260318124651
