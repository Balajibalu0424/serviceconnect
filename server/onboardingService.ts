import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  onboardingSessions,
  professionalProfiles,
  serviceCategories,
  users,
  jobs,
  creditTransactions,
  userSessions,
  type OnboardingSession,
} from "@shared/schema";
import {
  buildEmptyOnboardingPayload,
  buildEmptyVerificationState,
  customerJobDraftSchema,
  onboardingPasswordSchema,
  onboardingPatchSchema,
  onboardingSessionStateSchema,
  personalDetailsSchema,
  professionalProfileDraftSchema,
  type CustomerJobDraft,
  type OnboardingPatch,
  type OnboardingRole,
  type OnboardingSessionState,
  type OnboardingStep,
  type PersonalDetails,
  type ProfessionalProfileDraft,
} from "@shared/onboarding";
import { VERIFICATION_SESSION_TTL_HOURS } from "@shared/verification";
import { moderateText } from "./moderationService";
import { detectCategory, detectUrgency, scoreJobQuality } from "./aiEngine";
import { handleOnboardingChat } from "./geminiService";
import { generateTokens, hashPassword } from "./auth";
import { invalidateVerificationChallenges } from "./verificationService";

type CategoryOption = { id: string; name: string; slug: string; baseCreditCost?: number | null };

interface IntakeValidationResult<TDraft> {
  draft: TDraft;
  isReady: boolean;
  missingFields: string[];
  blockingMessage?: string;
}

const SESSION_EXTENSION_MS = VERIFICATION_SESSION_TTL_HOURS * 60 * 60 * 1000;

function buildGreeting(role: OnboardingRole): string {
  if (role === "CUSTOMER") {
    return "Tell me what needs sorting, where it is, and anything important about the job. I’ll turn it into a clean brief for local professionals.";
  }

  return "Tell me what kind of work you do, where you cover, and what makes you good at it. I’ll shape that into a strong ServiceConnect profile.";
}

function buildIntakeSummaryMessage(role: OnboardingRole): string {
  if (role === "CUSTOMER") {
    return "That looks complete. Review the job summary below, make any edits you want, and then we’ll collect your contact details.";
  }

  return "That gives us enough to build your professional profile. Review the summary below, tweak anything you want, and then we’ll finish your contact details.";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}

function trimNullable(value?: string | null): string | null {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : null;
}

function deriveTitle(description: string): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return sentence.slice(0, 72);
}

function getStartingStep(role: OnboardingRole): OnboardingStep {
  return role === "CUSTOMER" ? "JOB_INTAKE" : "PROFILE_INTAKE";
}

function parseStoredSession(record: OnboardingSession): OnboardingSessionState {
  return onboardingSessionStateSchema.parse({
    id: record.id,
    role: record.role,
    currentStep: record.currentStep,
    status: record.status,
    payload: {
      ...buildEmptyOnboardingPayload(record.role),
      ...(record.payload as Record<string, unknown>),
      role: record.role,
    },
    transcript: Array.isArray(record.transcript) ? record.transcript : [],
    verificationState: {
      ...buildEmptyVerificationState(),
      ...((record.verificationState as Record<string, unknown>) || {}),
    },
    expiresAt: record.expiresAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

function appendTranscript(
  session: OnboardingSessionState,
  role: "assistant" | "user" | "system",
  content: string,
): OnboardingSessionState {
  return {
    ...session,
    transcript: [
      ...session.transcript,
      {
        role,
        content,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

async function persistSession(session: OnboardingSessionState): Promise<OnboardingSessionState> {
  const expiresAt = new Date(Date.now() + SESSION_EXTENSION_MS);

  const [updated] = await db
    .update(onboardingSessions)
    .set({
      currentStep: session.currentStep,
      status: session.status,
      payload: session.payload,
      transcript: session.transcript,
      verificationState: session.verificationState,
      expiresAt,
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(onboardingSessions.id, session.id))
    .returning();

  if (!updated) {
    throw new Error("Onboarding session not found");
  }

  return parseStoredSession(updated);
}

export async function createOnboardingSession(role: OnboardingRole, previousSessionId?: string): Promise<OnboardingSessionState> {
  if (previousSessionId) {
    await db
      .update(onboardingSessions)
      .set({ status: "ABANDONED", updatedAt: new Date() })
      .where(
        and(
          eq(onboardingSessions.id, previousSessionId),
          eq(onboardingSessions.status, "ACTIVE"),
        )!,
      );
  }

  const [session] = await db
    .insert(onboardingSessions)
    .values({
      role,
      currentStep: getStartingStep(role),
      status: "ACTIVE",
      payload: buildEmptyOnboardingPayload(role),
      transcript: [
        {
          role: "assistant",
          content: buildGreeting(role),
          createdAt: new Date().toISOString(),
        },
      ],
      verificationState: buildEmptyVerificationState(),
      expiresAt: new Date(Date.now() + SESSION_EXTENSION_MS),
    })
    .returning();

  return parseStoredSession(session);
}

export async function getOnboardingSession(sessionId: string): Promise<OnboardingSessionState> {
  const [session] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, sessionId)).limit(1);

  if (!session) {
    throw new Error("Onboarding session not found");
  }

  if (session.status === "ACTIVE" && session.expiresAt.getTime() < Date.now()) {
    const [expired] = await db
      .update(onboardingSessions)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(onboardingSessions.id, sessionId))
      .returning();

    if (!expired) {
      throw new Error("Onboarding session not found");
    }

    return parseStoredSession(expired);
  }

  return parseStoredSession(session);
}

export async function listActiveCategories(): Promise<CategoryOption[]> {
  return db
    .select({
      id: serviceCategories.id,
      name: serviceCategories.name,
      slug: serviceCategories.slug,
      baseCreditCost: serviceCategories.baseCreditCost,
    })
    .from(serviceCategories)
    .where(eq(serviceCategories.isActive, true));
}

function validateCustomerJobDraft(
  input: Partial<CustomerJobDraft> | null | undefined,
  categories: CategoryOption[],
): IntakeValidationResult<CustomerJobDraft> {
  const draft = customerJobDraftSchema.parse({
    ...input,
    title: trimNullable(input?.title) ?? deriveTitle(input?.description ?? ""),
    description: input?.description?.trim() ?? "",
    locationText: input?.locationText?.trim() ?? "",
    categoryId: input?.categoryId?.trim() ?? "",
    categoryLabel: input?.categoryLabel?.trim() ?? "",
    budgetMin: trimNullable(input?.budgetMin),
    budgetMax: trimNullable(input?.budgetMax),
    preferredDate: trimNullable(input?.preferredDate),
  });

  if (draft.title) {
    const titleModeration = moderateText(draft.title, { fieldName: "job title" });
    if (titleModeration.blocked) {
      return { draft, isReady: false, missingFields: ["title"], blockingMessage: titleModeration.userMessage };
    }
  }

  if (draft.description) {
    const descriptionModeration = moderateText(draft.description, { fieldName: "job description" });
    if (descriptionModeration.blocked) {
      return { draft, isReady: false, missingFields: ["description"], blockingMessage: descriptionModeration.userMessage };
    }
  }

  if (!draft.categoryId && (draft.title || draft.description)) {
    const detected = detectCategory(draft.title, draft.description, categories);
    if (detected.categorySlug) {
      const match = categories.find((category) => category.slug === detected.categorySlug);
      if (match) {
        draft.categoryId = match.id;
        draft.categoryLabel = match.name;
      }
    }
  } else if (draft.categoryId && !draft.categoryLabel) {
    const match = categories.find((category) => category.id === draft.categoryId);
    if (match) {
      draft.categoryLabel = match.name;
    }
  }

  if (!draft.urgency || draft.urgency === "NORMAL") {
    const urgency = detectUrgency(draft.title, draft.description);
    if (urgency.isUrgent) {
      draft.urgency = "URGENT";
    }
  }

  const missingFields: string[] = [];
  if (!draft.title) missingFields.push("title");
  if (!draft.description) missingFields.push("description");
  if (!draft.locationText) missingFields.push("location");
  if (!draft.categoryId) missingFields.push("category");

  if (missingFields.length === 0) {
    const quality = scoreJobQuality(
      draft.title,
      draft.description,
      draft.locationText,
      draft.categoryLabel || "service",
    );

    draft.aiQualityScore = quality.score;
    draft.aiQualityPrompt = quality.prompt;
    draft.completionIssues = quality.issues;

    if (!quality.passed) {
      missingFields.push("quality");
    }
  } else {
    draft.aiQualityScore = null;
    draft.aiQualityPrompt = null;
    draft.completionIssues = [];
  }

  return {
    draft,
    isReady: missingFields.length === 0,
    missingFields,
  };
}

function validateProfessionalProfileDraft(
  input: Partial<ProfessionalProfileDraft> | null | undefined,
  categories: CategoryOption[],
): IntakeValidationResult<ProfessionalProfileDraft> {
  const rawCategoryIds = input?.categoryIds?.filter(Boolean) ?? [];
  const categoryLabels = rawCategoryIds
    .map((categoryId) => categories.find((category) => category.id === categoryId)?.name)
    .filter((label): label is string => Boolean(label));

  const location = input?.location?.trim() ?? "";
  const bio = input?.bio?.trim() ?? "";
  const serviceAreas = (input?.serviceAreas ?? []).map((area) => area.trim()).filter(Boolean);

  const draft = professionalProfileDraftSchema.parse({
    ...input,
    categoryIds: rawCategoryIds,
    categoryLabels,
    location,
    serviceAreas: serviceAreas.length > 0 ? serviceAreas : location ? [location] : [],
    serviceRadius: input?.serviceRadius ?? 25,
    yearsExperience: input?.yearsExperience ?? null,
    bio,
    businessName: trimNullable(input?.businessName),
    credentials: trimNullable(input?.credentials),
  });

  if (draft.bio) {
    const moderation = moderateText(draft.bio, { fieldName: "profile bio" });
    if (moderation.blocked) {
      return { draft, isReady: false, missingFields: ["bio"], blockingMessage: moderation.userMessage };
    }
  }

  const missingFields: string[] = [];
  if (draft.categoryIds.length === 0) missingFields.push("categories");
  if (!draft.location) missingFields.push("location");
  if (!draft.bio || draft.bio.length < 24) missingFields.push("bio");

  return {
    draft,
    isReady: missingFields.length === 0,
    missingFields,
  };
}

function validatePersonalDetails(input: Partial<PersonalDetails> | undefined): {
  details: Partial<PersonalDetails>;
  isReady: boolean;
  missingFields: string[];
} {
  const details = {
    firstName: input?.firstName?.trim() ?? "",
    lastName: input?.lastName?.trim() ?? "",
    email: input?.email ? normalizeEmail(input.email) : "",
    phone: input?.phone ? normalizePhone(input.phone) : "",
  };

  const missingFields: string[] = [];
  if (!details.firstName) missingFields.push("firstName");
  if (!details.lastName) missingFields.push("lastName");
  if (!details.email || !z.string().email().safeParse(details.email).success) missingFields.push("email");
  if (!details.phone || details.phone.replace(/\D/g, "").length < 7) missingFields.push("phone");

  return {
    details,
    isReady: missingFields.length === 0,
    missingFields,
  };
}

function ensureStep(session: OnboardingSessionState, allowedSteps: OnboardingStep[]): void {
  if (!allowedSteps.includes(session.currentStep)) {
    throw new Error(`Session is not in a valid step for this action: ${session.currentStep}`);
  }
}

function buildChatHistory(session: OnboardingSessionState, message: string) {
  return [
    ...session.transcript.map((entry) => ({
      role: entry.role === "system" ? "assistant" : entry.role,
      content: entry.content,
    })),
    { role: "user" as const, content: message },
  ];
}

export async function processOnboardingChat(
  sessionId: string,
  message: string,
  categories: CategoryOption[],
): Promise<OnboardingSessionState> {
  let session = await getOnboardingSession(sessionId);
  ensureStep(session, ["JOB_INTAKE", "PROFILE_INTAKE"]);

  const aiResponse = await handleOnboardingChat(
    buildChatHistory(session, message),
    session.role,
    categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
    true,
  );

  session = appendTranscript(session, "user", message);

  if (session.role === "CUSTOMER") {
    const merged = {
      ...(session.payload.customerJob ?? customerJobDraftSchema.parse({})),
      ...(aiResponse.extractedData ?? {}),
    };
    const validation = validateCustomerJobDraft(merged, categories);
    session.payload.customerJob = validation.draft;

    if (validation.blockingMessage) {
      session = appendTranscript(session, "assistant", validation.blockingMessage);
      return persistSession(session);
    }

    if (validation.isReady) {
      session.currentStep = "JOB_REVIEW";
      session = appendTranscript(session, "assistant", buildIntakeSummaryMessage("CUSTOMER"));
      return persistSession(session);
    }
  } else {
    const merged = {
      ...(session.payload.professionalProfile ?? professionalProfileDraftSchema.parse({})),
      ...(aiResponse.extractedData ?? {}),
    };
    const validation = validateProfessionalProfileDraft(merged, categories);
    session.payload.professionalProfile = validation.draft;

    if (validation.blockingMessage) {
      session = appendTranscript(session, "assistant", validation.blockingMessage);
      return persistSession(session);
    }

    if (validation.isReady) {
      session.currentStep = "PROFILE_REVIEW";
      session = appendTranscript(session, "assistant", buildIntakeSummaryMessage("PROFESSIONAL"));
      return persistSession(session);
    }
  }

  session = appendTranscript(
    session,
    "assistant",
    aiResponse.reply || "I still need a little more detail before I can move you forward.",
  );

  return persistSession(session);
}

export async function patchOnboardingSession(
  sessionId: string,
  patch: OnboardingPatch,
  categories: CategoryOption[],
): Promise<OnboardingSessionState> {
  let session = await getOnboardingSession(sessionId);
  const parsedPatch = onboardingPatchSchema.parse(patch);

  if (parsedPatch.role && parsedPatch.role !== session.role) {
    throw new Error("Role changes require a new onboarding session");
  }

  if (parsedPatch.customerJob && session.role === "CUSTOMER") {
    const merged = {
      ...(session.payload.customerJob ?? customerJobDraftSchema.parse({})),
      ...parsedPatch.customerJob,
    };
    const validation = validateCustomerJobDraft(merged, categories);
    session.payload.customerJob = validation.draft;
    session.currentStep = validation.isReady ? "JOB_REVIEW" : "JOB_INTAKE";
  }

  if (parsedPatch.professionalProfile && session.role === "PROFESSIONAL") {
    const merged = {
      ...(session.payload.professionalProfile ?? professionalProfileDraftSchema.parse({})),
      ...parsedPatch.professionalProfile,
    };
    const validation = validateProfessionalProfileDraft(merged, categories);
    session.payload.professionalProfile = validation.draft;
    session.currentStep = validation.isReady ? "PROFILE_REVIEW" : "PROFILE_INTAKE";
  }

  if (parsedPatch.personalDetails) {
    const previousEmail = session.payload.personalDetails.email ?? "";
    const previousPhone = session.payload.personalDetails.phone ?? "";
    const validation = validatePersonalDetails({
      ...session.payload.personalDetails,
      ...parsedPatch.personalDetails,
    });

    const emailChanged =
      parsedPatch.personalDetails.email !== undefined &&
      normalizeEmail(parsedPatch.personalDetails.email) !== normalizeEmail(previousEmail);
    const phoneChanged =
      parsedPatch.personalDetails.phone !== undefined &&
      normalizePhone(parsedPatch.personalDetails.phone) !== normalizePhone(previousPhone);

    session.payload.personalDetails = validation.details;

    if (emailChanged) {
      session.verificationState.emailVerified = false;
      await invalidateVerificationChallenges({ sessionId }, "EMAIL");
    }

    if (phoneChanged) {
      session.verificationState.phoneVerified = false;
      await invalidateVerificationChallenges({ sessionId }, "PHONE");
    }

    if (["PHONE_OTP", "EMAIL_OTP", "PASSWORD", "COMPLETE"].includes(session.currentStep)) {
      session.currentStep = validation.isReady ? "PERSONAL_REVIEW" : "PERSONAL_DETAILS";
    } else if (session.currentStep === "PERSONAL_REVIEW" || session.currentStep === "PERSONAL_DETAILS") {
      session.currentStep = validation.isReady ? "PERSONAL_REVIEW" : "PERSONAL_DETAILS";
    }
  }

  if (parsedPatch.action === "CONFIRM_INTAKE_REVIEW") {
    if (session.role === "CUSTOMER") {
      ensureStep(session, ["JOB_REVIEW"]);
      const validation = validateCustomerJobDraft(session.payload.customerJob, categories);
      session.payload.customerJob = validation.draft;
      if (!validation.isReady) {
        session.currentStep = "JOB_INTAKE";
        return persistSession(session);
      }
    } else {
      ensureStep(session, ["PROFILE_REVIEW"]);
      const validation = validateProfessionalProfileDraft(session.payload.professionalProfile, categories);
      session.payload.professionalProfile = validation.draft;
      if (!validation.isReady) {
        session.currentStep = "PROFILE_INTAKE";
        return persistSession(session);
      }
    }

    session.currentStep = "PERSONAL_DETAILS";
  }

  if (parsedPatch.action === "CONFIRM_PERSONAL_REVIEW") {
    ensureStep(session, ["PERSONAL_REVIEW"]);
    const validation = validatePersonalDetails(session.payload.personalDetails);
    session.payload.personalDetails = validation.details;
    if (!validation.isReady) {
      session.currentStep = "PERSONAL_DETAILS";
      return persistSession(session);
    }
    session.currentStep = "PHONE_OTP";
  }

  return persistSession(session);
}

export async function markOnboardingVerification(
  sessionId: string,
  channel: "EMAIL" | "PHONE",
): Promise<OnboardingSessionState> {
  const session = await getOnboardingSession(sessionId);
  if (channel === "PHONE") {
    session.verificationState.phoneVerified = true;
    session.currentStep = "EMAIL_OTP";
  } else {
    session.verificationState.emailVerified = true;
    session.currentStep = "PASSWORD";
  }
  return persistSession(session);
}

export async function recordOnboardingOtpSent(
  sessionId: string,
  channel: "EMAIL" | "PHONE",
): Promise<OnboardingSessionState> {
  const session = await getOnboardingSession(sessionId);

  if (channel === "PHONE") {
    ensureStep(session, ["PHONE_OTP"]);
    session.verificationState.phoneLastSentAt = new Date().toISOString();
  } else {
    ensureStep(session, ["EMAIL_OTP"]);
    session.verificationState.emailLastSentAt = new Date().toISOString();
  }

  return persistSession(session);
}

export async function completeOnboardingSession(
  sessionId: string,
  password: string,
  requestIp?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
  redirectTo: string;
  createdJobId?: string | null;
  createdProfileId?: string | null;
  jobStatus?: string | null;
  nextPrompt?: string | null;
}> {
  const session = await getOnboardingSession(sessionId);
  const parsedPassword = onboardingPasswordSchema.safeParse(password);
  if (!parsedPassword.success) {
    throw new Error(parsedPassword.error.issues[0]?.message || "Password is invalid");
  }

  const personalValidation = validatePersonalDetails(session.payload.personalDetails);
  if (!personalValidation.isReady) {
    throw new Error("Personal details are incomplete");
  }

  if (!session.verificationState.phoneVerified || !session.verificationState.emailVerified) {
    throw new Error("Email and phone verification must be completed before account creation");
  }

  const email = normalizeEmail(personalValidation.details.email ?? "");
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  const passwordHash = await hashPassword(parsedPassword.data);

  const completion = await db.transaction(async (tx) => {
    if (session.role === "CUSTOMER") {
      const categories = await tx
        .select({
          id: serviceCategories.id,
          name: serviceCategories.name,
          slug: serviceCategories.slug,
          baseCreditCost: serviceCategories.baseCreditCost,
        })
        .from(serviceCategories)
        .where(eq(serviceCategories.isActive, true));

      const jobValidation = validateCustomerJobDraft(session.payload.customerJob, categories);
      const [user] = await tx
        .insert(users)
        .values({
          email,
          phone: personalValidation.details.phone ?? "",
          passwordHash,
          role: "CUSTOMER",
          status: "ACTIVE",
          firstName: personalValidation.details.firstName ?? "",
          lastName: personalValidation.details.lastName ?? "",
          emailVerified: true,
          phoneVerified: true,
          onboardingCompleted: true,
        })
        .returning();

      const category = categories.find((item) => item.id === jobValidation.draft.categoryId);
      const creditCost = Number(category?.baseCreditCost ?? 2);
      const jobStatus = jobValidation.isReady ? "LIVE" : "DRAFT";

      const [job] = await tx
        .insert(jobs)
        .values({
          customerId: user.id,
          categoryId: jobValidation.draft.categoryId,
          title: jobValidation.draft.title,
          description: jobValidation.draft.description,
          budgetMin: jobValidation.draft.budgetMin,
          budgetMax: jobValidation.draft.budgetMax,
          urgency: jobValidation.draft.urgency,
          status: jobStatus,
          locationText: jobValidation.draft.locationText,
          preferredDate: jobValidation.draft.preferredDate ? new Date(jobValidation.draft.preferredDate) : null,
          creditCost,
          originalCreditCost: creditCost,
          aiQualityScore: jobValidation.draft.aiQualityScore,
          aiQualityPrompt: jobValidation.draft.aiQualityPrompt,
        })
        .returning();

      await tx.update(users).set({ firstJobId: job.id }).where(eq(users.id, user.id));

      return {
        user,
        redirectTo: "/dashboard",
        createdJobId: job.id,
        jobStatus,
        nextPrompt:
          jobStatus === "LIVE"
            ? "Your job is live and ready for professionals."
            : "Your account is ready. Your job was saved as a draft because it still needs a few improvements before publishing.",
      };
    }

    const profileValidation = validateProfessionalProfileDraft(session.payload.professionalProfile, await tx
      .select({
        id: serviceCategories.id,
        name: serviceCategories.name,
        slug: serviceCategories.slug,
      })
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true)));

    const [user] = await tx
      .insert(users)
      .values({
        email,
        phone: personalValidation.details.phone ?? "",
        passwordHash,
        role: "PROFESSIONAL",
        status: "ACTIVE",
        firstName: personalValidation.details.firstName ?? "",
        lastName: personalValidation.details.lastName ?? "",
        bio: profileValidation.draft.bio,
        emailVerified: true,
        phoneVerified: true,
        onboardingCompleted: true,
        creditBalance: 20,
      })
      .returning();

    const [profile] = await tx
      .insert(professionalProfiles)
      .values({
        userId: user.id,
        businessName: profileValidation.draft.businessName,
        credentials: profileValidation.draft.credentials,
        yearsExperience: profileValidation.draft.yearsExperience,
        radiusKm: profileValidation.draft.serviceRadius ?? 25,
        serviceCategories: profileValidation.draft.categoryIds,
        serviceAreas: profileValidation.draft.serviceAreas,
        isVerified: false,
        verificationStatus: "UNSUBMITTED",
        verificationLevel: "NONE",
      })
      .returning();

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "BONUS",
      amount: 20,
      balanceAfter: 20,
      description: "Starter credits awarded during professional onboarding",
    });

    return {
      user,
      profile,
      redirectTo: "/pro/dashboard",
      createdProfileId: profile.id,
      nextPrompt: "Your account is ready. Add optional trust details any time from your professional dashboard.",
    };
  });

  const { accessToken, refreshToken } = generateTokens(completion.user.id, completion.user.role);
  await db.insert(userSessions).values({
    userId: completion.user.id,
    refreshTokenHash: Buffer.from(refreshToken).toString("base64"),
    ipAddress: requestIp,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const [completedSession] = await db
    .update(onboardingSessions)
    .set({
      status: "COMPLETED",
      currentStep: "COMPLETE",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingSessions.id, sessionId))
    .returning();

  const userPayload = {
    id: completion.user.id,
    email: completion.user.email,
    firstName: completion.user.firstName,
    lastName: completion.user.lastName,
    role: completion.user.role,
    phone: completion.user.phone,
    creditBalance: completion.user.creditBalance,
    emailVerified: completion.user.emailVerified,
    phoneVerified: completion.user.phoneVerified,
    onboardingCompleted: completion.user.onboardingCompleted,
  };

  return {
    accessToken,
    refreshToken,
    user: userPayload,
    redirectTo: completion.redirectTo,
    createdJobId: "createdJobId" in completion ? completion.createdJobId ?? null : null,
    createdProfileId: "createdProfileId" in completion ? completion.createdProfileId ?? null : null,
    jobStatus: "jobStatus" in completion ? completion.jobStatus ?? null : null,
    nextPrompt: completion.nextPrompt ?? null,
  };
}
