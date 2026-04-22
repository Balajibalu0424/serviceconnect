import { detectCategory, detectUrgency, scoreJobQuality } from "./aiEngine";

export interface QuestioningCategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface CustomerQuestioningDraft {
  title: string;
  description: string;
  categoryId: string;
  categoryLabel: string;
  locationText: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  budgetMin: string | null;
  budgetMax: string | null;
  preferredDate: string | null;
}

export interface ProfessionalQuestioningDraft {
  categoryIds: string[];
  categoryLabels: string[];
  bio: string;
  location: string;
  serviceAreas: string[];
  yearsExperience: number | null;
  serviceRadius: number | null;
  businessName: string | null;
  credentials: string | null;
}

interface FollowUpRule {
  matches: (text: string) => boolean;
  question: string;
}

const TIMING_RE = /\b(today|tonight|tomorrow|asap|urgent|urgently|this week|next week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;
const SCALE_RE = /\b(\d+\s*(bed|bedroom|bath|bathroom|room|rooms|item|items|window|windows|door|doors|wall|walls|floor|floors|guest|guests|person|people|attendee|attendees|hour|hours|m2|sq|square|acre)|one[- ]off|regular|weekly|monthly|fortnightly|small|medium|large|whole|entire|single|multiple)\b/i;
const PROPERTY_RE = /\b(house|home|flat|apartment|office|shop|restaurant|warehouse|commercial|business|property)\b/i;
const LOCATION_HINT_RE = /\b(dublin(?:\s+\d+)?|cork|galway|limerick|waterford|meath|kildare|wicklow|wexford|kilkenny|donegal|mayo|sligo|tipperary|laois|ireland)\b/i;

const CUSTOMER_FOLLOW_UPS: Record<string, FollowUpRule[]> = {
  plumbing: [
    {
      matches: (text) => /\b(leak|drip|blocked|burst|install|replace|repair|fault|pressure|overflow|diagnos)\b/i.test(text),
      question: "Is this a repair, replacement, installation, blockage, or leak investigation?",
    },
    {
      matches: (text) => /\b(tap|toilet|sink|pipe|radiator|boiler|shower|bath|drain|cylinder|valve|stopcock|heater)\b/i.test(text),
      question: "What exactly is affected - for example a tap, toilet, shower, pipe, radiator, boiler, or drain?",
    },
    {
      matches: (text) => PROPERTY_RE.test(text) || /\b(kitchen|bathroom|utility|ensuite|garden|outside)\b/i.test(text),
      question: "Where in the property is the plumbing issue, and is this in a house, flat, or business premises?",
    },
  ],
  electrical: [
    {
      matches: (text) => /\b(install|replace|repair|fault|tripping|rewire|inspect|test|diagnos)\b/i.test(text),
      question: "Do you need an electrical repair, a new installation, fault finding, or an inspection?",
    },
    {
      matches: (text) => /\b(light|socket|switch|consumer unit|fuse|circuit|charger|alarm|extractor|appliance|spotlight|panel)\b/i.test(text),
      question: "What electrical item or circuit is involved - for example lights, sockets, a consumer unit, EV charger, or another fitting?",
    },
    {
      matches: (text) => PROPERTY_RE.test(text),
      question: "Is this at a house, flat, or business property, and how many fittings or rooms are affected?",
    },
  ],
  cleaning: [
    {
      matches: (text) => /\b(one[- ]?off|deep clean|regular|weekly|fortnightly|monthly|end of tenancy|move[- ]?out|office)\b/i.test(text),
      question: "Is this a one-off clean, a deep clean, end-of-tenancy, or a regular cleaning arrangement?",
    },
    {
      matches: (text) => /\b(\d+\s*(bed|bedroom|bathroom|room)|house|flat|apartment|office|commercial|m2|square)\b/i.test(text),
      question: "What type of property is it, and roughly how many bedrooms, bathrooms, rooms, or square metres are involved?",
    },
    {
      matches: (text) => /\b(oven|carpet|window|bathroom|kitchen|whole house|whole home|communal|after builders)\b/i.test(text),
      question: "Are there any priority areas to clean, such as kitchens, bathrooms, carpets, ovens, or windows?",
    },
  ],
  painting: [
    {
      matches: (text) => /\b(interior|exterior|inside|outside)\b/i.test(text),
      question: "Is the painting work interior or exterior?",
    },
    {
      matches: (text) => /\b(room|bedroom|hallway|kitchen|bathroom|living room|ceiling|wall|woodwork|door|window|fence|facade)\b/i.test(text),
      question: "Which rooms or surfaces need painting - for example walls, ceilings, woodwork, doors, windows, or fencing?",
    },
    {
      matches: (text) => SCALE_RE.test(text) || /\b(paint supplied|materials supplied|primer|prep|preparation)\b/i.test(text),
      question: "Roughly how big is the job, and will you be supplying the paint or should the professional include materials?",
    },
  ],
  gardening: [
    {
      matches: (text) => /\b(mow|trim|prune|weed|clear|landscap|turf|plant|hedge|tree|patio|deck|fence)\b/i.test(text),
      question: "What gardening work do you need - for example lawn mowing, hedge cutting, clearance, planting, tree work, or landscaping?",
    },
    {
      matches: (text) => /\b(front garden|back garden|small|medium|large|lawn|hedge|\d+\s*(m2|square|metre|meter))\b/i.test(text),
      question: "How big is the garden or area involved, and are there any specific sections that need attention?",
    },
    {
      matches: (text) => /\b(one[- ]?off|regular|weekly|monthly|maintenance|green waste|waste removal)\b/i.test(text),
      question: "Is this a one-off visit or ongoing maintenance, and do you need green waste taken away?",
    },
  ],
  removals: [
    {
      matches: (text) => /\b(from\b.*\bto\b|pickup|drop[- ]?off|collection|delivery|move from|move to)\b/i.test(text),
      question: "What are the collection and drop-off areas for the move?",
    },
    {
      matches: (text) => /\b(studio|1 bed|2 bed|3 bed|4 bed|house|flat|apartment|office|boxes|sofa|bed|wardrobe|table|van load)\b/i.test(text),
      question: "How much needs moving - for example a few items, boxes, or the contents of a flat or house?",
    },
    {
      matches: (text) => /\b(stairs|lift|elevator|ground floor|first floor|packing|disassembly|assembly|parking)\b/i.test(text),
      question: "Are there stairs, lifts, parking restrictions, or packing and furniture assembly needs to factor in?",
    },
  ],
  handyman: [
    {
      matches: (text) => /\b(assemble|mount|hang|repair|replace|fix|install|seal|grout|drill)\b/i.test(text),
      question: "What exact handyman tasks do you need done?",
    },
    {
      matches: (text) => /\b(tv|shelf|curtain|blind|door|handle|hinge|furniture|wardrobe|cabinet|mirror|tile)\b/i.test(text),
      question: "What items or fittings are involved - for example furniture, shelving, curtains, doors, mirrors, or tiling?",
    },
    {
      matches: (text) => SCALE_RE.test(text),
      question: "How many items or areas need attention, and are materials or replacement parts already on site?",
    },
  ],
  tutoring: [
    {
      matches: (text) => /\b(math|maths|english|science|biology|chemistry|physics|irish|french|spanish|german|coding|piano|guitar)\b/i.test(text),
      question: "What subject or skill do you need help with?",
    },
    {
      matches: (text) => /\b(primary|secondary|junior cert|leaving cert|gcse|a-level|adult|college|university|year \d+)\b/i.test(text),
      question: "What level is the learner at - for example primary, secondary, Leaving Cert, college, or adult learner?",
    },
    {
      matches: (text) => /\b(online|in person|at home|zoom|teams|weekly|twice|session)\b/i.test(text),
      question: "Would you prefer online or in-person tutoring, and how often do you want sessions?",
    },
  ],
  photography: [
    {
      matches: (text) => /\b(wedding|birthday|event|corporate|headshot|portrait|product|branding|real estate|video|videography)\b/i.test(text),
      question: "What type of photography or videography do you need?",
    },
    {
      matches: (text) => TIMING_RE.test(text),
      question: "When is the shoot or event taking place?",
    },
    {
      matches: (text) => /\b(hour|hours|half day|full day|guest|guests|attendee|attendees|location|venue)\b/i.test(text),
      question: "Where is it happening, and roughly how long or how many guests or deliverables are involved?",
    },
  ],
  catering: [
    {
      matches: (text) => /\b(wedding|birthday|corporate|private|party|bbq|buffet|lunch|dinner|canape)\b/i.test(text),
      question: "What kind of event is the catering for?",
    },
    {
      matches: (text) => /\b(\d+\s*(guest|guests|person|people|attendee|attendees))\b/i.test(text),
      question: "How many people do you need catering for?",
    },
    {
      matches: (text) => /\b(vegan|vegetarian|halal|gluten|allergy|allergies)\b/i.test(text),
      question: "Are there any dietary requirements, service style preferences, or menu constraints we should mention?",
    },
  ],
  "web-design": [
    {
      matches: (text) => /\b(new website|redesign|landing page|ecommerce|shopify|wordpress|booking|portfolio|brochure)\b/i.test(text),
      question: "Is this a brand new website, a redesign, or a specific landing page or ecommerce build?",
    },
    {
      matches: (text) => /\b(business|company|brand|restaurant|trades|clinic|startup|service)\b/i.test(text),
      question: "What does the business do, and what is the main goal of the website?",
    },
    {
      matches: (text) => /\b(seo|payments|booking|contact form|cms|mobile|logo|branding|copywriting|integration|integrations)\b/i.test(text),
      question: "What features do you need on the site - for example booking, ecommerce, payments, SEO, branding, or copywriting?",
    },
  ],
  "personal-training": [
    {
      matches: (text) => /\b(weight loss|lose weight|muscle|strength|fitness|marathon|mobility|rehab|postpartum|conditioning)\b/i.test(text),
      question: "What is the main fitness goal - for example weight loss, strength, mobility, rehab, or event prep?",
    },
    {
      matches: (text) => /\b(online|gym|home|outdoor|in person)\b/i.test(text),
      question: "Would you like online sessions, gym-based coaching, or in-person training at home or outdoors?",
    },
    {
      matches: (text) => /\b(weekly|twice|three times|session|sessions|ongoing)\b/i.test(text),
      question: "How often would you like sessions, and are there any injuries or limitations the trainer should know about?",
    },
  ],
  "pet-care": [
    {
      matches: (text) => /\b(dog|cat|puppy|kitten|pet|rabbit|bird)\b/i.test(text),
      question: "What type of pet or pets is this for, and how many are involved?",
    },
    {
      matches: (text) => /\b(walk|walking|boarding|sitting|grooming|training|day care|check-in|feeding)\b/i.test(text),
      question: "What pet-care service do you need - walking, sitting, grooming, training, boarding, or something else?",
    },
    {
      matches: (text) => TIMING_RE.test(text) || /\b(daily|weekly|weekdays|weekends|overnight)\b/i.test(text),
      question: "What dates, times, or recurring schedule do you need cover for?",
    },
  ],
  "auto-repair": [
    {
      matches: (text) => /\b(car|van|truck|vehicle|ford|toyota|bmw|audi|volkswagen|nissan|hyundai|kia)\b/i.test(text),
      question: "What vehicle is it - make, model, and year if you know them?",
    },
    {
      matches: (text) => /\b(engine|brake|tyre|battery|service|nct|mot|diagnos|noise|warning light|clutch|gearbox|windscreen)\b/i.test(text),
      question: "What problem are you having with the vehicle, or what work do you need carried out?",
    },
    {
      matches: (text) => /\b(won't start|wont start|drivable|can drive|breakdown|roadside|garage)\b/i.test(text),
      question: "Is the vehicle still drivable, and where is it located now?",
    },
  ],
  legal: [
    {
      matches: (text) => /\b(employment|family|conveyancing|immigration|contract|dispute|probate|tenancy|injury|court)\b/i.test(text),
      question: "What type of legal help do you need?",
    },
    {
      matches: (text) => /\b(personal|business|company|landlord|tenant|employee|employer)\b/i.test(text),
      question: "Is this a personal or business matter, and who is involved?",
    },
    {
      matches: (text) => TIMING_RE.test(text) || /\b(deadline|hearing|urgent|asap)\b/i.test(text),
      question: "Is there a deadline, hearing date, or urgent milestone the solicitor should know about?",
    },
  ],
  accounting: [
    {
      matches: (text) => /\b(bookkeeping|tax|vat|payroll|annual accounts|self-assessment|revenue|audit|xero|quickbooks)\b/i.test(text),
      question: "What accounting help do you need - bookkeeping, tax returns, VAT, payroll, accounts, or software support?",
    },
    {
      matches: (text) => /\b(personal|sole trader|limited company|business|contractor|landlord)\b/i.test(text),
      question: "Is this for you personally, a sole trader, or a limited company?",
    },
    {
      matches: (text) => /\b(monthly|year end|quarter|weekly|once off|2024|2025|2026)\b/i.test(text),
      question: "What period needs covering, and is this a one-off job or ongoing support?",
    },
  ],
};

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function trimNullable(value: unknown): string | null {
  const trimmed = trimString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function deriveTitle(description: string): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return sentence.slice(0, 72);
}

function extractImplicitLocation(text: string): string {
  const match = text.match(LOCATION_HINT_RE);
  if (!match) return "";
  const value = match[1] ?? match[0];
  return value
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function resolveCategory(value: string, categories: QuestioningCategoryOption[]): QuestioningCategoryOption | undefined {
  if (!value) return undefined;
  const next = value.trim().toLowerCase();
  return categories.find((category) =>
    category.id === value ||
    category.slug.toLowerCase() === next ||
    category.name.toLowerCase() === next ||
    category.name.toLowerCase().includes(next) ||
    next.includes(category.name.toLowerCase()),
  );
}

function normalizeUrgency(value: unknown): CustomerQuestioningDraft["urgency"] {
  if (typeof value !== "string") return "NORMAL";
  const next = value.trim().toUpperCase();
  if (next === "LOW" || next === "NORMAL" || next === "HIGH" || next === "URGENT") {
    return next;
  }
  return "NORMAL";
}

function timingKnown(draft: CustomerQuestioningDraft): boolean {
  return Boolean(draft.preferredDate) || draft.urgency !== "NORMAL" || TIMING_RE.test(`${draft.title} ${draft.description}`);
}

function buildCategoryPrompt(categoryLabel: string): string {
  return `What kind of ${categoryLabel.toLowerCase()} work do you need, and what part of the property, item, or project is involved?`;
}

function buildGenericSpecificityPrompt(categoryLabel: string): string {
  return `To brief the ${categoryLabel.toLowerCase()} professional properly, what is the size or quantity involved, and are there any key access, material, or condition details they should know?`;
}

function buildCustomerFollowUpQuestion(draft: CustomerQuestioningDraft, categorySlug: string | null): string {
  const text = `${draft.title} ${draft.description}`.toLowerCase();

  if (!draft.categoryId) {
    return "What type of service do you need so I can route this to the right professionals?";
  }

  if (!draft.description) {
    return buildCategoryPrompt(draft.categoryLabel || "service");
  }

  const categoryRules = categorySlug ? CUSTOMER_FOLLOW_UPS[categorySlug] ?? [] : [];
  for (const rule of categoryRules) {
    if (!rule.matches(text)) {
      return rule.question;
    }
  }

  if (!SCALE_RE.test(text) && !PROPERTY_RE.test(text)) {
    return buildGenericSpecificityPrompt(draft.categoryLabel || "service");
  }

  if (!draft.locationText) {
    return "What town, area, or postcode is the job in?";
  }

  if (!timingKnown(draft)) {
    return `When would you like the ${draft.categoryLabel.toLowerCase()} work done?`;
  }

  return "That gives me enough to draft a strong job brief.";
}

export function normalizeCustomerQuestioningDraft(
  extractedData: Record<string, unknown> | null | undefined,
  categories: QuestioningCategoryOption[],
): { draft: CustomerQuestioningDraft; categorySlug: string | null } {
  const description = trimString(extractedData?.description);
  const title = trimString(extractedData?.title) || deriveTitle(description);
  const categoryValue = trimString(extractedData?.categoryId) || trimString(extractedData?.categoryLabel);
  const resolvedCategory = resolveCategory(categoryValue, categories) ||
    (title || description ? (() => {
      const detected = detectCategory(title, description, categories);
      return detected.categorySlug ? categories.find((category) => category.slug === detected.categorySlug) : undefined;
    })() : undefined);

  const inferredUrgency = detectUrgency(title, description);
  const preferredDate = trimNullable(extractedData?.preferredDate);
  const implicitLocation = extractImplicitLocation(`${title} ${description}`);

  const draft: CustomerQuestioningDraft = {
    title,
    description,
    categoryId: resolvedCategory?.id || "",
    categoryLabel: resolvedCategory?.name || trimString(extractedData?.categoryLabel),
    locationText: trimString(extractedData?.locationText) || implicitLocation,
    urgency: normalizeUrgency(extractedData?.urgency),
    budgetMin: trimNullable(extractedData?.budgetMin),
    budgetMax: trimNullable(extractedData?.budgetMax),
    preferredDate,
  };

  if (draft.urgency === "NORMAL" && inferredUrgency.isUrgent) {
    draft.urgency = "URGENT";
  }

  return { draft, categorySlug: resolvedCategory?.slug || null };
}

export function refineCustomerOnboardingResponse(
  extractedData: Record<string, unknown> | null | undefined,
  categories: QuestioningCategoryOption[],
): { reply: string; isComplete: boolean; extractedData: CustomerQuestioningDraft } {
  const { draft, categorySlug } = normalizeCustomerQuestioningDraft(extractedData, categories);
  const hasCoreFields = Boolean(draft.title && draft.description && draft.categoryId && draft.locationText);

  if (!hasCoreFields) {
    return {
      reply: buildCustomerFollowUpQuestion(draft, categorySlug),
      isComplete: false,
      extractedData: draft,
    };
  }

  const quality = scoreJobQuality(
    draft.title,
    draft.description,
    draft.locationText,
    draft.categoryLabel || "service",
  );
  const shouldKeepAsking = !quality.passed || !timingKnown(draft);

  return {
    reply: shouldKeepAsking ? buildCustomerFollowUpQuestion(draft, categorySlug) : "Perfect - I have enough to draft your job clearly.",
    isComplete: !shouldKeepAsking,
    extractedData: draft,
  };
}

export function refineProfessionalOnboardingResponse(
  extractedData: Record<string, unknown> | null | undefined,
  categories: QuestioningCategoryOption[],
): { reply: string; isComplete: boolean; extractedData: ProfessionalQuestioningDraft } {
  const rawCategoryIds = Array.isArray(extractedData?.categoryIds) ? extractedData.categoryIds : [];
  const resolvedCategories = rawCategoryIds
    .map((value) => resolveCategory(String(value ?? ""), categories))
    .filter((category): category is QuestioningCategoryOption => Boolean(category));

  const uniqueCategories = Array.from(new Map(resolvedCategories.map((category) => [category.id, category])).values());
  const bio = trimString(extractedData?.bio);
  const location = trimString(extractedData?.location);
  const serviceAreas = Array.isArray(extractedData?.serviceAreas)
    ? extractedData.serviceAreas.map((area) => trimString(area)).filter(Boolean)
    : [];
  const yearsExperienceRaw = extractedData?.yearsExperience;
  const serviceRadiusRaw = extractedData?.serviceRadius;

  const draft: ProfessionalQuestioningDraft = {
    categoryIds: uniqueCategories.map((category) => category.id),
    categoryLabels: uniqueCategories.map((category) => category.name),
    bio,
    location,
    serviceAreas: serviceAreas.length > 0 ? serviceAreas : location ? [location] : [],
    yearsExperience: yearsExperienceRaw == null ? null : Number(yearsExperienceRaw) || null,
    serviceRadius: serviceRadiusRaw == null ? 25 : Number(serviceRadiusRaw) || 25,
    businessName: trimNullable(extractedData?.businessName),
    credentials: trimNullable(extractedData?.credentials),
  };

  let reply = "Perfect - I have enough to build your profile.";
  let isComplete = true;

  if (draft.categoryIds.length === 0) {
    reply = "What services or trades do you offer so I can match your profile to the right categories?";
    isComplete = false;
  } else if (!draft.location) {
    reply = "What is your base location, and which towns or areas do you usually cover?";
    isComplete = false;
  } else if (!draft.yearsExperience) {
    reply = "How many years of experience do you have in this type of work?";
    isComplete = false;
  } else if (!draft.bio || draft.bio.length < 40) {
    reply = "Give me a short profile summary covering the kind of jobs you take on, your experience, and what makes clients choose you.";
    isComplete = false;
  }

  return { reply, isComplete, extractedData: draft };
}
