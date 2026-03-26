/**
 * ServiceConnect — Gemini AI Service Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralises all Google Gemini interactions.  Every function returns a typed
 * result and falls back gracefully when the API key is missing or the model
 * is unreachable.
 *
 * Model: gemini-2.0-flash (fast, cheap, excellent for structured output)
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

// ─── Initialise Client ───────────────────────────────────────────────────────

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

function getModel() {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    safetySettings,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function ask(prompt: string): Promise<string> {
  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function askJSON<T>(prompt: string): Promise<T> {
  const raw = await ask(prompt);
  // Extract JSON from markdown code fences if present
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
  const cleaned = (jsonMatch[1] || raw).trim();
  return JSON.parse(cleaned) as T;
}

// ─── 1. ENHANCE JOB DESCRIPTION ──────────────────────────────────────────────

export interface EnhanceDescriptionResult {
  enhanced: string;
  improvements: string[];
}

export async function enhanceJobDescription(
  title: string,
  description: string,
  category: string
): Promise<EnhanceDescriptionResult> {
  const prompt = `You are a professional copywriter for a home services marketplace called ServiceConnect (similar to Bark.com) based in Ireland.

A customer submitted this job posting:
Title: "${title}"
Category: ${category}
Description: "${description}"

Rewrite the description to be:
- Professional yet friendly
- Detailed with specific scope (size, quantity, materials if inferable)
- Well-structured with clear expectations
- 60-120 words maximum

Return ONLY valid JSON:
{
  "enhanced": "the rewritten description",
  "improvements": ["list of 2-3 things you improved"]
}`;

  try {
    return await askJSON<EnhanceDescriptionResult>(prompt);
  } catch {
    return { enhanced: description, improvements: [] };
  }
}

// ─── 2. SMART CATEGORY DETECTION ─────────────────────────────────────────────

export interface SmartCategoryResult {
  categorySlug: string;
  confidence: number;
  reason: string;
}

export async function smartCategoryDetect(
  title: string,
  description: string,
  availableCategories: Array<{ slug: string; name: string }>
): Promise<SmartCategoryResult> {
  const catList = availableCategories.map(c => `${c.slug}: ${c.name}`).join("\n");

  const prompt = `You are a job classification engine for ServiceConnect, an Irish home services marketplace.

Available categories:
${catList}

Job posting:
Title: "${title}"
Description: "${description}"

Classify this job into exactly ONE category. Return ONLY valid JSON:
{
  "categorySlug": "the-slug",
  "confidence": 0.0 to 1.0,
  "reason": "one-sentence explanation"
}`;

  try {
    return await askJSON<SmartCategoryResult>(prompt);
  } catch {
    return { categorySlug: "", confidence: 0, reason: "AI classification unavailable" };
  }
}

// ─── 3. DEEP FAKE JOB ANALYSIS ──────────────────────────────────────────────

export interface DeepFakeResult {
  isSuspicious: boolean;
  riskScore: number;     // 0–100
  reasons: string[];
  recommendation: "APPROVE" | "REVIEW" | "REJECT";
}

export async function deepFakeAnalysis(
  title: string,
  description: string,
  customerEmail: string,
  budgetMin?: number | null,
  budgetMax?: number | null
): Promise<DeepFakeResult> {
  const prompt = `You are a fraud detection AI for ServiceConnect, an Irish home services marketplace.

Analyse this job posting for signs of spam, scams, or fake postings:

Title: "${title}"
Description: "${description}"
Customer email domain: ${customerEmail.split("@")[1] || "unknown"}
Budget: ${budgetMin || "not set"} – ${budgetMax || "not set"} EUR

Red flags to check:
- Vague/generic description with no real work needed
- Requests for money transfer, crypto, or personal info
- Unrealistic budget (too low or absurdly high)
- Copy-paste spam patterns
- Suspicious email domains
- Contact info farming (asking pros to contact externally)

Return ONLY valid JSON:
{
  "isSuspicious": true/false,
  "riskScore": 0 to 100,
  "reasons": ["list of concerns, empty if clean"],
  "recommendation": "APPROVE" | "REVIEW" | "REJECT"
}`;

  try {
    return await askJSON<DeepFakeResult>(prompt);
  } catch {
    return { isSuspicious: false, riskScore: 0, reasons: [], recommendation: "APPROVE" };
  }
}

// ─── 4. QUOTE SUGGESTION FOR PROS ───────────────────────────────────────────

export interface QuoteSuggestion {
  suggestedMin: number;
  suggestedMax: number;
  message: string;
  tips: string[];
}

export async function generateQuoteSuggestion(
  jobTitle: string,
  jobDescription: string,
  jobCategory: string,
  proName: string,
  proSkills: string[]
): Promise<QuoteSuggestion> {
  const prompt = `You are a pricing advisor for ServiceConnect, an Irish home services marketplace.

A professional (${proName}, skills: ${proSkills.join(", ")}) wants to quote on this job:

Title: "${jobTitle}"
Category: ${jobCategory}
Description: "${jobDescription}"

Based on typical Irish market rates for ${jobCategory} services, suggest:
1. A fair price range in EUR
2. A professional opening message the pro could send
3. Tips for winning this job

Return ONLY valid JSON:
{
  "suggestedMin": number,
  "suggestedMax": number,
  "message": "suggested professional message to the customer",
  "tips": ["2-3 tips for winning"]
}`;

  try {
    return await askJSON<QuoteSuggestion>(prompt);
  } catch {
    return { suggestedMin: 0, suggestedMax: 0, message: "", tips: [] };
  }
}

// ─── 5. AI CHAT ASSISTANT ───────────────────────────────────────────────────

export async function aiChatAssistant(
  userMessage: string,
  userRole: "CUSTOMER" | "PROFESSIONAL" | "ADMIN",
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<string> {
  const contextMessages = conversationHistory
    .slice(-6) // keep last 6 messages for context
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are ServiceConnect AI Assistant, a helpful chatbot for an Irish home services marketplace (similar to Bark.com).

The user is a ${userRole.toLowerCase()}.

${contextMessages ? `Previous conversation:\n${contextMessages}\n` : ""}

User's message: "${userMessage}"

Guidelines:
- Be friendly, concise, and helpful
- For CUSTOMER: help with posting jobs, understanding the process, finding pros
- For PROFESSIONAL: help with credits, bidding, profile tips, understanding the platform
- For ADMIN: help with platform management, metrics, user issues
- If asked something unrelated to ServiceConnect, politely redirect
- Use Irish/UK English spellings
- Keep responses under 150 words
- NEVER share personal data or make up specific prices

Respond naturally:`;

  try {
    return await ask(prompt);
  } catch {
    return "I'm sorry, the AI assistant is temporarily unavailable. Please try again in a moment, or contact our support team for help.";
  }
}

// ─── 6. SMART PRO MATCHING ──────────────────────────────────────────────────

export interface ProMatchScore {
  proId: string;
  score: number;       // 0–100
  reason: string;
}

export async function smartProMatch(
  jobTitle: string,
  jobDescription: string,
  jobCategory: string,
  proProfiles: Array<{
    id: string;
    name: string;
    bio: string;
    skills: string[];
    rating: number;
    completedJobs: number;
  }>
): Promise<ProMatchScore[]> {
  if (proProfiles.length === 0) return [];

  const prosText = proProfiles.map((p, i) =>
    `${i + 1}. ID:${p.id} | ${p.name} | Skills: ${p.skills.join(", ")} | Rating: ${p.rating}/5 | Jobs: ${p.completedJobs} | Bio: "${p.bio?.substring(0, 100)}"`
  ).join("\n");

  const prompt = `You are a job matching engine for ServiceConnect, an Irish home services marketplace.

Job posting:
Title: "${jobTitle}"
Category: ${jobCategory}
Description: "${jobDescription}"

Available professionals:
${prosText}

Rank the top ${Math.min(5, proProfiles.length)} professionals by relevance. Consider skills match, experience (completed jobs), rating, and bio relevance.

Return ONLY a valid JSON array:
[
  { "proId": "id", "score": 0-100, "reason": "one-sentence why" }
]`;

  try {
    return await askJSON<ProMatchScore[]>(prompt);
  } catch {
    return proProfiles.map(p => ({
      proId: p.id,
      score: 50,
      reason: "AI matching unavailable — showing default order",
    }));
  }
}

// ─── 7. REVIEW SUMMARY GENERATION ──────────────────────────────────────────

export async function generateReviewSummary(
  proName: string,
  reviews: Array<{ rating: number; comment: string; customerName: string }>
): Promise<string> {
  if (reviews.length === 0) return "";

  const reviewText = reviews.slice(0, 10).map((r, i) =>
    `${i + 1}. ${r.rating}/5 stars by ${r.customerName}: "${r.comment}"`
  ).join("\n");

  const prompt = `You are writing a professional summary for a service provider profile on ServiceConnect, an Irish home services marketplace.

Professional: ${proName}
Total reviews: ${reviews.length}
Average rating: ${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}/5

Recent reviews:
${reviewText}

Write a 2-3 sentence professional summary highlighting their strengths based on customer feedback. Use third person. Keep it warm but professional. Do NOT use quotation marks around the summary.`;

  try {
    return await ask(prompt);
  } catch {
    return "";
  }
}

// ─── 8. ENHANCE PRO BIO ────────────────────────────────────────────────────

export interface EnhanceBioResult {
  enhanced: string;
  improvements: string[];
}

export async function enhanceProBio(
  currentBio: string,
  skills: string[],
  proName: string
): Promise<EnhanceBioResult> {
  const prompt = `You are a professional profile writer for ServiceConnect, an Irish home services marketplace.

Professional: ${proName}
Skills: ${skills.join(", ")}
Current bio: "${currentBio}"

Rewrite this bio to be:
- Professional yet personable
- Highlighting key skills and experience
- Trustworthy and confidence-inspiring
- 50-100 words maximum
- Written in first person

Return ONLY valid JSON:
{
  "enhanced": "the rewritten bio",
  "improvements": ["2-3 things improved"]
}`;

  try {
    return await askJSON<EnhanceBioResult>(prompt);
  } catch {
    return { enhanced: currentBio, improvements: [] };
  }
}

// ─── 9. CONVERSATIONAL ONBOARDING ────────────────────────────────────────────

export interface OnboardingChatResult {
  reply: string;
  isComplete: boolean;
  extractedData: any;
}

export async function handleOnboardingChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  mode: "CUSTOMER" | "PROFESSIONAL",
  availableCategories: Array<{ id: string; name: string; slug: string }>,
  isLoggedIn: boolean = true
): Promise<OnboardingChatResult> {
  const catList = availableCategories.map(c => `- ${c.name} (ID: ${c.id})`).join("\n");

  const customerPrompt = `You are ServiceConnect's AI onboarding assistant. Your goal is to help a CUSTOMER post a new job.
You need to collect the following information conversationally:
1. What they need done (Job title/description)
2. Location
3. Urgency (Low, Normal, High, Urgent)
4. Budget (optional, but good to ask)
5. The most appropriate category ID from this list:
${catList}
${!isLoggedIn ? `6. First Name\n7. Last Name\n8. Email address\n9. Phone Number (optional)\n(Since the user is not logged in, ask for their name and contact info so we can set up their account.)` : ""}

Ask ONE question at a time if information is missing. Be brief, friendly, and professional. You do NOT have to ask about budget or phone number if they provide everything else, but you must ask for Name and Email if they are not logged in.
If you have collected enough information to post the job, you MUST set "isComplete" to true and populate "extractedData".

Return ONLY valid JSON in this format:
{
  "reply": "Your next conversational response to the user",
  "isComplete": boolean,
  "extractedData": {
    "title": "Short title",
    "description": "Detailed description",
    "categoryId": "number or uuid",
    "locationText": "string",
    "urgency": "LOW|NORMAL|HIGH|URGENT",
    "budgetMin": null,
    "budgetMax": null${!isLoggedIn ? `,\n    "firstName": "string",\n    "lastName": "string",\n    "email": "string",\n    "phone": "string"` : ""}
  }
}`;

  const proPrompt = `You are ServiceConnect's AI onboarding assistant. Your goal is to help a PROFESSIONAL sign up to the platform.
You need to collect the following information conversationally:
1. What services they offer (to map to category IDs)
2. Their location and service radius
3. Years of experience
4. A short bio/description of their business
Here are the available categories:
${catList}

Ask ONE question at a time if information is missing. Be brief, friendly, and professional.
If you have collected enough information (services, location, experience, bio), you MUST set "isComplete" to true and populate "extractedData".

Return ONLY valid JSON in this format:
{
  "reply": "Your next conversational response to the user",
  "isComplete": boolean,
  "extractedData": {
    "categoryIds": ["array of category IDs"],
    "bio": "Extracted bio",
    "location": "string",
    "yearsExperience": number,
    "serviceRadius": 25
  }
}`;

  const systemPrompt = mode === "CUSTOMER" ? customerPrompt : proPrompt;
  const history = messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  
  const finalPrompt = `${systemPrompt}\n\nConversation so far:\n${history}\n\nAnalyse the conversation and respond with the JSON object:`;

  try {
    return await askJSON<OnboardingChatResult>(finalPrompt);
  } catch (e) {
    console.error("Onboarding chat error", e);
    return {
      reply: "I'm sorry, I'm having trouble processing that right now. Could you try rephrasing?",
      isComplete: false,
      extractedData: null
    };
  }
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────

export function isGeminiAvailable(): boolean {
  return !!genAI;
}
