import {
  pgTable, pgEnum, text, varchar, integer, boolean, timestamp,
  decimal, json, index, uniqueIndex, serial
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["CUSTOMER", "PROFESSIONAL", "ADMIN", "SUPPORT"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "BANNED", "PENDING"]);
export const urgencyEnum = pgEnum("urgency", ["LOW", "NORMAL", "HIGH", "URGENT"]);
export const jobStatusEnum = pgEnum("job_status", [
  "DRAFT", "LIVE", "IN_DISCUSSION", "MATCHED", "BOOKED", "AFTERCARE_2D", "AFTERCARE_5D",
  "BOOSTED", "COMPLETED", "CLOSED"
]);
export const unlockTierEnum = pgEnum("unlock_tier", ["FREE", "STANDARD"]);
export const aftercareBranchEnum = pgEnum("aftercare_branch", ["TWO_DAY", "FIVE_DAY"]);
export const customerResponseEnum = pgEnum("customer_response", ["SORTED", "NOT_SORTED"]);
export const quoteStatusEnum = pgEnum("quote_status", ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"
]);
export const convTypeEnum = pgEnum("conv_type", ["DIRECT", "SUPPORT"]);
export const convStatusEnum = pgEnum("conv_status", ["ACTIVE", "ARCHIVED", "BLOCKED"]);
export const participantRoleEnum = pgEnum("participant_role", ["MEMBER", "ADMIN", "OBSERVER"]);
export const messageTypeEnum = pgEnum("message_type", ["TEXT", "IMAGE", "FILE", "SYSTEM", "QUOTE", "LOCATION"]);
export const creditTxTypeEnum = pgEnum("credit_tx_type", [
  "PURCHASE", "SPEND", "REFUND", "BONUS", "ADMIN_GRANT", "UPGRADE"
]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "COMPLETED", "FAILED", "REFUNDED"]);
export const spinPrizeEnum = pgEnum("spin_prize", ["CREDITS", "BOOST", "BADGE", "DISCOUNT", "NONE"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"]);
export const onboardingRoleEnum = pgEnum("onboarding_role", ["CUSTOMER", "PROFESSIONAL"]);
export const onboardingStepEnum = pgEnum("onboarding_step", [
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
export const onboardingStatusEnum = pgEnum("onboarding_status", ["ACTIVE", "COMPLETED", "ABANDONED", "EXPIRED"]);
export const verificationChannelEnum = pgEnum("verification_channel", ["EMAIL", "PHONE"]);
export const verificationPurposeEnum = pgEnum("verification_purpose", ["ONBOARDING", "PHONE_UPDATE"]);

// ─── Users & Auth ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  firstJobId: varchar("first_job_id"),
  creditBalance: integer("credit_balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("users_role_idx").on(t.role),
  index("users_status_idx").on(t.status),
]);

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const phoneVerificationTokens = pgTable("phone_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  hashedCode: text("hashed_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("phone_tokens_user_idx").on(t.userId)]);

export const onboardingSessions = pgTable("onboarding_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: onboardingRoleEnum("role").notNull(),
  currentStep: onboardingStepEnum("current_step").notNull().default("ROLE_SELECTION"),
  status: onboardingStatusEnum("status").notNull().default("ACTIVE"),
  payload: json("payload").$type<Record<string, unknown>>().notNull().default({}),
  transcript: json("transcript").$type<Array<Record<string, unknown>>>().notNull().default([]),
  verificationState: json("verification_state").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("onboarding_status_idx").on(t.status),
  index("onboarding_expires_idx").on(t.expiresAt),
  index("onboarding_role_idx").on(t.role),
]);

export const verificationChallenges = pgTable("verification_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => onboardingSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  channel: verificationChannelEnum("channel").notNull(),
  purpose: verificationPurposeEnum("purpose").notNull().default("ONBOARDING"),
  target: text("target").notNull(),
  hashedCode: text("hashed_code").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  sentCount: integer("sent_count").notNull().default(1),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  invalidatedAt: timestamp("invalidated_at"),
  lastSentAt: timestamp("last_sent_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("verification_session_idx").on(t.sessionId),
  index("verification_user_idx").on(t.userId),
  index("verification_target_idx").on(t.target),
  index("verification_channel_idx").on(t.channel),
]);

export const verificationLevelEnum = pgEnum("verification_level", ["NONE", "SELF_DECLARED", "DOCUMENT_VERIFIED"]);

export const professionalProfiles = pgTable("professional_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  credentials: text("credentials"),
  licenseNumber: text("license_number"),
  insuranceVerified: boolean("insurance_verified").notNull().default(false),
  yearsExperience: integer("years_experience"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
  totalReviews: integer("total_reviews").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationLevel: verificationLevelEnum("verification_level").notNull().default("NONE"),
  verificationStatus: text("verification_status").notNull().default("UNSUBMITTED"),
  verificationDocumentUrl: text("verification_document_url"),
  verificationSubmittedAt: timestamp("verification_submitted_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  verificationReviewNote: text("verification_review_note"),
  serviceCategories: json("service_categories").$type<string[]>().default([]),
  serviceAreas: json("service_areas").$type<string[]>().default([]),
  portfolio: json("portfolio").$type<object[]>().default([]),
  availability: json("availability").$type<object>().default({}),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  radiusKm: integer("radius_km").default(25),
  subscriptionTier: text("subscription_tier").default("FREE"),
  lastSpinAt: timestamp("last_spin_at"),
  spinStreak: integer("spin_streak").notNull().default(0),
  earnedBadges: json("earned_badges").$type<string[]>().default([]),
  profileBoostUntil: timestamp("profile_boost_until"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ─── Service Categories ───────────────────────────────────────────────────────
export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: varchar("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  baseCreditCost: integer("base_credit_cost").notNull().default(2),
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  categoryId: varchar("category_id").notNull().references(() => serviceCategories.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  budgetMin: decimal("budget_min", { precision: 10, scale: 2 }),
  budgetMax: decimal("budget_max", { precision: 10, scale: 2 }),
  locationText: text("location_text"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  urgency: urgencyEnum("urgency").notNull().default("NORMAL"),
  status: jobStatusEnum("status").notNull().default("DRAFT"),
  creditCost: integer("credit_cost").notNull().default(2),
  originalCreditCost: integer("original_credit_cost").notNull().default(2),
  isBoosted: boolean("is_boosted").notNull().default(false),
  boostCount: integer("boost_count").notNull().default(0),
  blockedRepost: boolean("blocked_repost").notNull().default(false),
  hasTokenPurchases: boolean("has_token_purchases").notNull().default(false),
  aftercareBranch: aftercareBranchEnum("aftercare_branch"),
  preferredDate: timestamp("preferred_date"),
  mediaUrls: json("media_urls").$type<string[]>().default([]),
  expiresAt: timestamp("expires_at"),
  // AI Engine — Phase 1 columns
  aiQualityScore: integer("ai_quality_score"),
  aiQualityPrompt: text("ai_quality_prompt"),
  aiIsFakeFlag: boolean("ai_is_fake_flag").notNull().default(false),
  aiFakeReason: text("ai_fake_reason"),
  aiIsUrgent: boolean("ai_is_urgent").notNull().default(false),
  aiUrgencyKeywords: json("ai_urgency_keywords").$type<string[]>().default([]),
  aiCategorySlug: varchar("ai_category_slug"),
  aiCategoryConfidence: varchar("ai_category_confidence"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("jobs_customer_idx").on(t.customerId),
  index("jobs_category_idx").on(t.categoryId),
  index("jobs_status_idx").on(t.status),
  index("jobs_created_idx").on(t.createdAt),
]);

export const jobMatchbooks = pgTable("job_matchbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  professionalId: varchar("professional_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  matchbookedAt: timestamp("matchbooked_at").notNull().default(sql`now()`),
  removedAt: timestamp("removed_at"),
}, (t) => [
  uniqueIndex("matchbook_unique_idx").on(t.jobId, t.professionalId),
  index("matchbook_pro_idx").on(t.professionalId),
]);

export const jobUnlocks = pgTable("job_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  professionalId: varchar("professional_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tier: unlockTierEnum("tier").notNull(),
  creditsSpent: integer("credits_spent").notNull().default(0),
  phoneUnlocked: boolean("phone_unlocked").notNull().default(false),
  unlockedAt: timestamp("unlocked_at").notNull().default(sql`now()`),
  upgradedAt: timestamp("upgraded_at"),
}, (t) => [
  uniqueIndex("unlock_unique_idx").on(t.jobId, t.professionalId),
  index("unlock_pro_idx").on(t.professionalId),
]);

// ─── Aftercare & Boost ────────────────────────────────────────────────────────
export const jobAftercares = pgTable("job_aftercares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  branch: aftercareBranchEnum("branch").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().default(sql`now()`),
  customerResponse: customerResponseEnum("customer_response"),
  boostOffered: boolean("boost_offered").notNull().default(false),
  boostAccepted: boolean("boost_accepted").notNull().default(false),
  closedAt: timestamp("closed_at"),
  repostedAt: timestamp("reposted_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  autoClosedAt: timestamp("auto_closed_at"),
}, (t) => [index("aftercare_job_idx").on(t.jobId)]);

export const jobBoosts = pgTable("job_boosts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  boostFeePaid: decimal("boost_fee_paid", { precision: 10, scale: 2 }).notNull(),
  creditDiscountPct: integer("credit_discount_pct").notNull().default(40),
  originalCreditCost: integer("original_credit_cost").notNull(),
  boostedCreditCost: integer("boosted_credit_cost").notNull(),
  boostedAt: timestamp("boosted_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at"),
}, (t) => [index("boost_job_idx").on(t.jobId)]);

// ─── Quotes & Bookings ────────────────────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  professionalId: varchar("professional_id").notNull().references(() => users.id),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  message: text("message"),
  estimatedDuration: text("estimated_duration"),
  status: quoteStatusEnum("status").notNull().default("PENDING"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("quotes_job_idx").on(t.jobId),
  index("quotes_pro_idx").on(t.professionalId),
]);

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobId: varchar("job_id").notNull().references(() => jobs.id),
  customerId: varchar("customer_id").notNull().references(() => users.id),
  professionalId: varchar("professional_id").notNull().references(() => users.id),
  serviceDate: timestamp("service_date"),
  serviceTime: text("service_time"),
  durationHours: decimal("duration_hours", { precision: 4, scale: 1 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: bookingStatusEnum("status").notNull().default("CONFIRMED"),
  cancellationReason: text("cancellation_reason"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("bookings_customer_idx").on(t.customerId),
  index("bookings_pro_idx").on(t.professionalId),
]);

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  title: text("title"),
  comment: text("comment"),
  response: text("response"),
  responseAt: timestamp("response_at"),
  proReply: text("pro_reply"),
  proRepliedAt: timestamp("pro_replied_at"),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("reviews_reviewee_idx").on(t.revieweeId)]);

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: convTypeEnum("type").notNull().default("DIRECT"),
  jobId: varchar("job_id").references(() => jobs.id),
  status: convStatusEnum("status").notNull().default("ACTIVE"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("conv_job_idx").on(t.jobId)]);

export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: participantRoleEnum("role").notNull().default("MEMBER"),
  lastReadAt: timestamp("last_read_at"),
  isMuted: boolean("is_muted").notNull().default(false),
}, (t) => [
  uniqueIndex("participant_unique_idx").on(t.conversationId, t.userId),
  index("participant_user_idx").on(t.userId),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  type: messageTypeEnum("type").notNull().default("TEXT"),
  content: text("content").notNull(),
  metadata: json("metadata").$type<object>().default({}),
  parentId: varchar("parent_id"),
  isFiltered: boolean("is_filtered").notNull().default(false),
  originalContent: text("original_content"),
  filterFlags: json("filter_flags").$type<string[]>().default([]),
  isEdited: boolean("is_edited").notNull().default(false),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("messages_conv_idx").on(t.conversationId),
  index("messages_sender_idx").on(t.senderId),
  index("messages_created_idx").on(t.createdAt),
]);

// ─── Credits & Payments ───────────────────────────────────────────────────────
export const creditPackages = pgTable("credit_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bonusCredits: integer("bonus_credits").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: creditTxTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("tx_user_idx").on(t.userId)]);

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  paymentMethod: text("payment_method"),
  stripePaymentId: text("stripe_payment_id"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("payments_user_idx").on(t.userId)]);

// ─── Gamification ─────────────────────────────────────────────────────────────
export const spinWheelEvents = pgTable("spin_wheel_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  professionalId: varchar("professional_id").notNull().references(() => users.id),
  spunAt: timestamp("spun_at").notNull().default(sql`now()`),
  nextEligibleAt: timestamp("next_eligible_at").notNull(),
  prizeType: spinPrizeEnum("prize_type").notNull(),
  prizeValue: integer("prize_value"),
  prizeApplied: boolean("prize_applied").notNull().default(false),
}, (t) => [index("spin_pro_idx").on(t.professionalId)]);

// ─── Support & Admin ──────────────────────────────────────────────────────────
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "GENERAL", "BILLING", "JOB", "PROFESSIONAL", "TECHNICAL", "SAFETY", "ACCOUNT"
]);

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  category: text("category"),
  priority: ticketPriorityEnum("priority").notNull().default("MEDIUM"),
  status: ticketStatusEnum("status").notNull().default("OPEN"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  // SLA tracking
  firstResponseAt: timestamp("first_response_at"),
  slaDeadline: timestamp("sla_deadline"),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  // Satisfaction
  satisfactionRating: integer("satisfaction_rating"),
  satisfactionComment: text("satisfaction_comment"),
  ratedAt: timestamp("rated_at"),
  // Lifecycle
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  reopenedAt: timestamp("reopened_at"),
  reopenCount: integer("reopen_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("tickets_user_idx").on(t.userId),
  index("tickets_status_idx").on(t.status),
  index("tickets_assigned_idx").on(t.assignedTo),
  index("tickets_priority_idx").on(t.priority),
]);

export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("ticket_msg_idx").on(t.ticketId)]);

// FAQ / Knowledge Base
export const faqArticles = pgTable("faq_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull().default("GENERAL"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  helpfulCount: integer("helpful_count").notNull().default(0),
  notHelpfulCount: integer("not_helpful_count").notNull().default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [
  index("faq_cat_idx").on(t.category),
  index("faq_published_idx").on(t.isPublished),
]);

// Canned responses for support staff
export const cannedResponses = pgTable("canned_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("GENERAL"),
  shortcut: text("shortcut"),
  usageCount: integer("usage_count").notNull().default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (t) => [index("canned_cat_idx").on(t.category)]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: json("data").$type<object>().default({}),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("notif_user_idx").on(t.userId),
  index("notif_read_idx").on(t.isRead),
]);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  changes: json("changes").$type<object>().default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [index("audit_admin_idx").on(t.adminId)]);

export const platformMetrics = pgTable("platform_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricName: text("metric_name").notNull(),
  metricValue: decimal("metric_value", { precision: 20, scale: 4 }).notNull(),
  dimensions: json("dimensions").$type<object>().default({}),
  recordedAt: timestamp("recorded_at").notNull().default(sql`now()`),
}, (t) => [
  index("metrics_name_idx").on(t.metricName),
  index("metrics_recorded_idx").on(t.recordedAt),
]);

export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  rolloutPercentage: integer("rollout_percentage").notNull().default(100),
  conditions: json("conditions").$type<object>().default({}),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// ─── Call Requests (replaces phone sharing) ───────────────────────────────────
export const callRequestStatusEnum = pgEnum("call_request_status", ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "COMPLETED"]);

export const callRequests = pgTable("call_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  targetId: varchar("target_id").notNull().references(() => users.id),
  jobId: varchar("job_id").references(() => jobs.id),
  bookingId: varchar("booking_id").references(() => bookings.id),
  status: callRequestStatusEnum("status").notNull().default("PENDING"),
  reason: text("reason"),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("call_req_requester_idx").on(t.requesterId),
  index("call_req_target_idx").on(t.targetId),
]);

// ─── Insert Schemas ───────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFaqArticleSchema = createInsertSchema(faqArticles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCannedResponseSchema = createInsertSchema(cannedResponses).omit({ id: true, createdAt: true, updatedAt: true });

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type ProfessionalProfile = typeof professionalProfiles.$inferSelect;
export type JobMatchbook = typeof jobMatchbooks.$inferSelect;
export type JobUnlock = typeof jobUnlocks.$inferSelect;
export type JobAftercare = typeof jobAftercares.$inferSelect;
export type JobBoost = typeof jobBoosts.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type SpinWheelEvent = typeof spinWheelEvents.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type FaqArticle = typeof faqArticles.$inferSelect;
export type CannedResponse = typeof cannedResponses.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type PlatformMetric = typeof platformMetrics.$inferSelect;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type CallRequest = typeof callRequests.$inferSelect;
export type PhoneVerificationToken = typeof phoneVerificationTokens.$inferSelect;
export type InsertPhoneVerificationToken = typeof phoneVerificationTokens.$inferInsert;
export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type InsertOnboardingSession = typeof onboardingSessions.$inferInsert;
export type VerificationChallenge = typeof verificationChallenges.$inferSelect;
export type InsertVerificationChallenge = typeof verificationChallenges.$inferInsert;
