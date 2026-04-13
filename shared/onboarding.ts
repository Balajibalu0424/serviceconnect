import { z } from "zod";

export const onboardingRoleSchema = z.enum(["CUSTOMER", "PROFESSIONAL"]);

export const onboardingStepSchema = z.enum([
  "ROLE_SELECTION",
  "JOB_INTAKE",
  "JOB_REVIEW",
  "PROFILE_INTAKE",
  "PROFILE_REVIEW",
  "PERSONAL_DETAILS",
  "PERSONAL_REVIEW",
  "PHONE_OTP",
  "EMAIL_OTP",
  "PASSWORD",
  "COMPLETE",
]);

export const onboardingStatusSchema = z.enum(["ACTIVE", "COMPLETED", "ABANDONED", "EXPIRED"]);

export const verificationChannelSchema = z.enum(["EMAIL", "PHONE"]);
export const onboardingPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must contain at least one letter and one number",
  });

export const verificationStateSchema = z.object({
  emailVerified: z.boolean().default(false),
  phoneVerified: z.boolean().default(false),
  emailLastSentAt: z.string().nullable().default(null),
  phoneLastSentAt: z.string().nullable().default(null),
});

export const personalDetailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").default(""),
  lastName: z.string().trim().min(1, "Last name is required").default(""),
  email: z.string().trim().email("Valid email required").default(""),
  phone: z.string().trim().min(7, "Valid phone required").default(""),
});

export const customerJobDraftSchema = z.object({
  title: z.string().trim().default(""),
  description: z.string().trim().default(""),
  categoryId: z.string().trim().default(""),
  categoryLabel: z.string().trim().default(""),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).nullable().transform(v => v ?? "NORMAL").default("NORMAL"),
  locationText: z.string().trim().default(""),
  budgetMin: z.string().trim().nullable().default(null),
  budgetMax: z.string().trim().nullable().default(null),
  preferredDate: z.string().trim().nullable().default(null),
  completionIssues: z.array(z.string()).default([]),
  aiQualityScore: z.number().int().min(0).max(100).nullable().default(null),
  aiQualityPrompt: z.string().nullable().default(null),
});

export const professionalProfileDraftSchema = z.object({
  categoryIds: z.array(z.string().trim()).default([]),
  categoryLabels: z.array(z.string().trim()).default([]),
  location: z.string().trim().default(""),
  serviceAreas: z.array(z.string().trim()).default([]),
  serviceRadius: z.number().int().min(1).max(500).nullable().default(25),
  yearsExperience: z.number().int().min(0).max(80).nullable().default(null),
  bio: z.string().trim().default(""),
  businessName: z.string().trim().nullable().default(null),
  credentials: z.string().trim().nullable().default(null),
});

export const onboardingTranscriptEntrySchema = z.object({
  role: z.enum(["assistant", "user", "system"]),
  content: z.string(),
  createdAt: z.string(),
});

export const onboardingPayloadSchema = z.object({
  role: onboardingRoleSchema,
  customerJob: customerJobDraftSchema.nullable().default(null),
  professionalProfile: professionalProfileDraftSchema.nullable().default(null),
  personalDetails: personalDetailsSchema.partial().default({}),
  password: z.string().default(""),
});

export const onboardingSessionStateSchema = z.object({
  id: z.string(),
  role: onboardingRoleSchema,
  currentStep: onboardingStepSchema,
  status: onboardingStatusSchema,
  payload: onboardingPayloadSchema,
  transcript: z.array(onboardingTranscriptEntrySchema),
  verificationState: verificationStateSchema,
  expiresAt: z.string(),
  completedAt: z.string().nullable().default(null),
});

export const onboardingChatRequestSchema = z.object({
  message: z.string().trim().min(1),
});

export const onboardingPatchSchema = z.object({
  action: z.enum(["CONFIRM_INTAKE_REVIEW", "CONFIRM_PERSONAL_REVIEW"]).optional(),
  role: onboardingRoleSchema.optional(),
  customerJob: customerJobDraftSchema.partial().optional(),
  professionalProfile: professionalProfileDraftSchema.partial().optional(),
  personalDetails: personalDetailsSchema.partial().optional(),
});

export const onboardingOtpSendSchema = z.object({
  channel: verificationChannelSchema,
});

export const onboardingOtpVerifySchema = z.object({
  channel: verificationChannelSchema,
  code: z.string().trim().min(1),
});

export const onboardingCompleteSchema = z.object({
  password: onboardingPasswordSchema,
});

export const onboardingCompletionResultSchema = z.object({
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  user: z.record(z.string(), z.any()),
  redirectTo: z.string(),
  createdJobId: z.string().nullable().optional(),
  createdProfileId: z.string().nullable().optional(),
  jobStatus: z.string().nullable().optional(),
  nextPrompt: z.string().nullable().optional(),
});

export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;
export type VerificationChannel = z.infer<typeof verificationChannelSchema>;
export type OnboardingPassword = z.infer<typeof onboardingPasswordSchema>;
export type VerificationState = z.infer<typeof verificationStateSchema>;
export type PersonalDetails = z.infer<typeof personalDetailsSchema>;
export type CustomerJobDraft = z.infer<typeof customerJobDraftSchema>;
export type ProfessionalProfileDraft = z.infer<typeof professionalProfileDraftSchema>;
export type OnboardingTranscriptEntry = z.infer<typeof onboardingTranscriptEntrySchema>;
export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;
export type OnboardingSessionState = z.infer<typeof onboardingSessionStateSchema>;
export type OnboardingPatch = z.infer<typeof onboardingPatchSchema>;
export type OnboardingCompletionResult = z.infer<typeof onboardingCompletionResultSchema>;

export function buildEmptyOnboardingPayload(role: OnboardingRole): OnboardingPayload {
  return {
    role,
    customerJob: role === "CUSTOMER" ? customerJobDraftSchema.parse({}) : null,
    professionalProfile: role === "PROFESSIONAL" ? professionalProfileDraftSchema.parse({}) : null,
    personalDetails: {},
    password: "",
  };
}

export function buildEmptyVerificationState(): VerificationState {
  return verificationStateSchema.parse({});
}
