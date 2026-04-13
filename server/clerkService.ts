import { createClerkClient } from "@clerk/backend";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";

type InternalUser = typeof users.$inferSelect;

type BridgeTokenResult = {
  token: string;
  userId: string;
};

type ClerkApiErrorLike = {
  code?: string;
  message?: string;
  longMessage?: string;
};

type ClerkBridgeErrorLike = {
  status?: number;
  errors?: ClerkApiErrorLike[];
};

function trimEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getPublishableKey() {
  return trimEnv("VITE_CLERK_PUBLISHABLE_KEY") || trimEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
}

function getSecretKey() {
  return trimEnv("CLERK_SECRET_KEY");
}

export function getClerkWebhookSecret() {
  return trimEnv("CLERK_WEBHOOK_SECRET") || trimEnv("CLERK_WEBHOOK_SIGNING_SECRET");
}

export function isClerkBackendConfigured() {
  return Boolean(getSecretKey());
}

export function isClerkFrontendConfigured() {
  return Boolean(getPublishableKey());
}

export function isClerkMigrationEnabled() {
  return isClerkBackendConfigured() && isClerkFrontendConfigured();
}

export function isClerkWebhookConfigured() {
  return Boolean(getClerkWebhookSecret());
}

function getClerkClient() {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error("Clerk backend is not configured.");
  }

  return createClerkClient({ secretKey });
}

async function persistClerkLink(userId: string, clerkUserId: string, authSource: "CLERK_BRIDGE" | "CLERK_NATIVE") {
  await db
    .update(users)
    .set({
      clerkUserId,
      authSource,
      legacyAuthMigratedAt: authSource === "CLERK_BRIDGE" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function roleMetadata(user: InternalUser) {
  return {
    role: user.role,
    authSource: user.authSource,
  };
}

function privateMetadata(user: InternalUser) {
  return {
    internalUserId: user.id,
    onboardingCompleted: user.onboardingCompleted,
  };
}

function getUserPhoneNumbers(user: InternalUser) {
  const phone = user.phone?.trim();
  return phone ? [phone] : undefined;
}

export function isRecoverableClerkBridgeError(error: unknown) {
  const maybeError = error as ClerkBridgeErrorLike | undefined;
  if (!maybeError || !Array.isArray(maybeError.errors)) {
    return false;
  }

  return maybeError.errors.some((entry) => {
    const message = `${entry?.message || ""} ${entry?.longMessage || ""}`.toLowerCase();
    return (
      (maybeError.status === 422 &&
        (entry?.code === "form_data_missing" || message.includes("doesn't match user requirements"))) ||
      (maybeError.status === 403 && entry?.code === "unsupported_country_code")
    );
  });
}

async function verifyExistingIdentifiers(clerkUser: Awaited<ReturnType<ReturnType<typeof getClerkClient>["users"]["createUser"]>>, user: InternalUser) {
  const clerk = getClerkClient();

  if (user.email) {
    const email = normalizedEmail(user.email);
    const existingEmail = clerkUser.emailAddresses.find((entry) => normalizedEmail(entry.emailAddress) === email);

    if (existingEmail) {
      if (user.emailVerified && existingEmail.verification?.status !== "verified") {
        await clerk.emailAddresses.updateEmailAddress(existingEmail.id, { verified: true, primary: true });
      } else if (clerkUser.primaryEmailAddressId !== existingEmail.id) {
        await clerk.users.updateUser(clerkUser.id, { primaryEmailAddressID: existingEmail.id });
      }
    } else {
      await clerk.emailAddresses.createEmailAddress({
        userId: clerkUser.id,
        emailAddress: email,
        verified: user.emailVerified,
        primary: true,
      });
    }
  }

  if (user.phone) {
    const phone = user.phone.trim();
    const existingPhone = clerkUser.phoneNumbers.find((entry) => entry.phoneNumber === phone);

    if (existingPhone) {
      if (user.phoneVerified && existingPhone.verification?.status !== "verified") {
        await clerk.phoneNumbers.updatePhoneNumber(existingPhone.id, { verified: true, primary: true });
      } else if (clerkUser.primaryPhoneNumberId !== existingPhone.id) {
        await clerk.users.updateUser(clerkUser.id, { primaryPhoneNumberID: existingPhone.id });
      }
    } else {
      await clerk.phoneNumbers.createPhoneNumber({
        userId: clerkUser.id,
        phoneNumber: phone,
        verified: user.phoneVerified,
        primary: true,
      });
    }
  }
}

async function fetchPotentialClerkMatches(user: InternalUser) {
  const clerk = getClerkClient();
  const matches = new Map<string, Awaited<ReturnType<typeof clerk.users.getUser>>>();

  if (user.clerkUserId) {
    try {
      const byId = await clerk.users.getUser(user.clerkUserId);
      matches.set(byId.id, byId);
    } catch {
      // stale link, fall through to lookup paths
    }
  }

  const byExternalId = await clerk.users.getUserList({ externalId: [user.id], limit: 10 });
  for (const match of byExternalId.data) {
    matches.set(match.id, match);
  }

  if (user.email) {
    const byEmail = await clerk.users.getUserList({ emailAddress: [normalizedEmail(user.email)], limit: 10 });
    for (const match of byEmail.data) {
      matches.set(match.id, match);
    }
  }

  return Array.from(matches.values());
}

function getInternalUserIdFromClerkMetadata(clerkUser: Awaited<ReturnType<ReturnType<typeof getClerkClient>["users"]["getUser"]>>) {
  const internalUserId = clerkUser.privateMetadata?.internalUserId;
  return typeof internalUserId === "string" && internalUserId ? internalUserId : null;
}

export async function ensureClerkUserForInternalUser(
  user: InternalUser,
  options: { authSource?: "CLERK_BRIDGE" | "CLERK_NATIVE" } = {},
) {
  if (!isClerkMigrationEnabled()) {
    return null;
  }

  const clerk = getClerkClient();
  const authSource = options.authSource ?? (user.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE");
  const matches = await fetchPotentialClerkMatches(user);

  const conflicting = matches.find((match) => {
    const internalUserId = getInternalUserIdFromClerkMetadata(match);
    return internalUserId && internalUserId !== user.id;
  });

  if (conflicting) {
    throw new Error("A Clerk user with this identity is already linked to a different ServiceConnect account.");
  }

  let clerkUser = matches[0] ?? null;

  if (!clerkUser) {
    clerkUser = await clerk.users.createUser({
      externalId: user.id,
      emailAddress: [normalizedEmail(user.email)],
      phoneNumber: getUserPhoneNumbers(user),
      firstName: user.firstName,
      lastName: user.lastName,
      passwordDigest: user.passwordHash,
      passwordHasher: "bcrypt",
      skipPasswordChecks: true,
      skipLegalChecks: true,
      publicMetadata: roleMetadata(user),
      privateMetadata: privateMetadata(user),
    });
  } else {
    clerkUser = await clerk.users.updateUser(clerkUser.id, {
      externalId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      passwordDigest: user.passwordHash,
      passwordHasher: "bcrypt",
      skipPasswordChecks: true,
      skipLegalChecks: true,
      publicMetadata: roleMetadata(user),
      privateMetadata: privateMetadata(user),
    });
  }

  await verifyExistingIdentifiers(clerkUser, user);
  await persistClerkLink(user.id, clerkUser.id, authSource);

  return clerk.users.getUser(clerkUser.id);
}

export async function createClerkSignInTokenForInternalUser(
  user: InternalUser,
  authSource: "CLERK_BRIDGE" | "CLERK_NATIVE" = "CLERK_BRIDGE",
): Promise<BridgeTokenResult | null> {
  let clerkUser = null;
  try {
    clerkUser = await ensureClerkUserForInternalUser(user, { authSource });
  } catch (error) {
    if (isRecoverableClerkBridgeError(error)) {
      return null;
    }
    throw error;
  }
  if (!clerkUser) {
    return null;
  }

  const token = await getClerkClient().signInTokens.createSignInToken({
    userId: clerkUser.id,
    expiresInSeconds: 60,
  });

  return { token: token.token, userId: clerkUser.id };
}

export async function syncClerkPasswordFromInternalUser(user: InternalUser) {
  if (!isClerkMigrationEnabled()) {
    return;
  }

  let clerkUser = null;
  try {
    clerkUser = await ensureClerkUserForInternalUser(user, {
      authSource: user.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE",
    });
  } catch (error) {
    if (isRecoverableClerkBridgeError(error)) {
      return;
    }
    throw error;
  }

  if (!clerkUser) {
    return;
  }

  await getClerkClient().users.updateUser(clerkUser.id, {
    passwordDigest: user.passwordHash,
    passwordHasher: "bcrypt",
    skipPasswordChecks: true,
  });
}

export async function syncClerkVerificationState(userId: string) {
  if (!isClerkMigrationEnabled()) {
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return;
  }

  try {
    await ensureClerkUserForInternalUser(user, {
      authSource: user.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE",
    });
  } catch (error) {
    if (isRecoverableClerkBridgeError(error)) {
      return;
    }
    throw error;
  }
}

export async function resolveInternalUserFromClerkUserId(clerkUserId: string) {
  const [linkedUser] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  if (linkedUser) {
    return linkedUser;
  }

  if (!isClerkBackendConfigured()) {
    return null;
  }

  const clerkUser = await getClerkClient().users.getUser(clerkUserId);
  const metadataUserId = getInternalUserIdFromClerkMetadata(clerkUser);

  if (metadataUserId) {
    const [metadataUser] = await db.select().from(users).where(eq(users.id, metadataUserId));
    if (metadataUser) {
      await persistClerkLink(metadataUser.id, clerkUserId, metadataUser.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE");
      return metadataUser;
    }
  }

  const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null;
  if (!primaryEmail) {
    return null;
  }

  const [emailUser] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, normalizedEmail(primaryEmail)),
        eq(users.id, clerkUser.externalId || "__missing__"),
      ),
    );

  if (!emailUser) {
    return null;
  }

  await persistClerkLink(emailUser.id, clerkUserId, emailUser.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE");
  return emailUser;
}

export async function findInternalUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail(email)));
  return user ?? null;
}

export async function markUserAsClerkNative(userId: string, clerkUserId: string) {
  await db
    .update(users)
    .set({
      clerkUserId,
      authSource: "CLERK_NATIVE",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function findLinkedUserByEmailOrClerkId(email: string, clerkUserId?: string | null) {
  const normalized = normalizedEmail(email);
  const [user] = await db
    .select()
    .from(users)
    .where(
      clerkUserId
        ? or(eq(users.email, normalized), eq(users.clerkUserId, clerkUserId))
        : eq(users.email, normalized),
    );

  return user ?? null;
}

type ClerkWebhookVerification = {
  status?: string | null;
};

type ClerkWebhookEmailAddress = {
  id: string;
  email_address: string;
  verification?: ClerkWebhookVerification | null;
};

type ClerkWebhookPhoneNumber = {
  id: string;
  phone_number: string;
  verification?: ClerkWebhookVerification | null;
};

type ClerkWebhookUserPayload = {
  id: string;
  external_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  primary_phone_number_id?: string | null;
  email_addresses?: ClerkWebhookEmailAddress[];
  phone_numbers?: ClerkWebhookPhoneNumber[];
};

function resolvePrimaryEmailAddress(data: ClerkWebhookUserPayload) {
  const emailAddresses = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  if (emailAddresses.length === 0) return null;

  const primary =
    emailAddresses.find((entry) => entry.id === data.primary_email_address_id) ?? emailAddresses[0] ?? null;

  if (!primary?.email_address) return null;

  return {
    value: normalizedEmail(primary.email_address),
    verified: primary.verification?.status === "verified",
  };
}

function resolvePrimaryPhoneNumber(data: ClerkWebhookUserPayload) {
  const phoneNumbers = Array.isArray(data.phone_numbers) ? data.phone_numbers : [];
  if (phoneNumbers.length === 0) return null;

  const primary =
    phoneNumbers.find((entry) => entry.id === data.primary_phone_number_id) ?? phoneNumbers[0] ?? null;

  if (!primary?.phone_number) return null;

  return {
    value: primary.phone_number.trim(),
    verified: primary.verification?.status === "verified",
  };
}

export async function syncInternalUserFromClerkWebhookUser(data: ClerkWebhookUserPayload) {
  const primaryEmail = resolvePrimaryEmailAddress(data);
  const primaryPhone = resolvePrimaryPhoneNumber(data);
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.clerkUserId, data.id),
        data.external_id ? eq(users.id, data.external_id) : eq(users.id, "__missing__"),
        primaryEmail ? eq(users.email, primaryEmail.value) : eq(users.email, "__missing__"),
      ),
    )
    .limit(1);

  if (!existingUser) {
    return null;
  }

  let nextEmail = existingUser.email;
  if (primaryEmail) {
    const conflictingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, primaryEmail.value), ne(users.id, existingUser.id)))
      .limit(1);

    if (conflictingEmail.length === 0) {
      nextEmail = primaryEmail.value;
    }
  }

  let nextPhone = existingUser.phone;
  if (primaryPhone) {
    const conflictingPhone = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, primaryPhone.value), ne(users.id, existingUser.id)))
      .limit(1);

    if (conflictingPhone.length === 0) {
      nextPhone = primaryPhone.value;
    }
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      clerkUserId: data.id,
      authSource: existingUser.authSource === "CLERK_NATIVE" ? "CLERK_NATIVE" : "CLERK_BRIDGE",
      email: nextEmail,
      phone: nextPhone,
      firstName: data.first_name?.trim() || existingUser.firstName,
      lastName: data.last_name?.trim() || existingUser.lastName,
      avatarUrl: data.image_url?.trim() || existingUser.avatarUrl,
      emailVerified: existingUser.emailVerified || primaryEmail?.verified || false,
      phoneVerified: existingUser.phoneVerified || primaryPhone?.verified || false,
      legacyAuthMigratedAt:
        existingUser.legacyAuthMigratedAt ?? (existingUser.authSource === "LEGACY" ? new Date() : existingUser.legacyAuthMigratedAt),
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  return updatedUser ?? existingUser;
}

export async function unlinkInternalUserFromClerk(clerkUserId: string, externalId?: string | null) {
  const [existingUser] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.clerkUserId, clerkUserId),
        externalId ? eq(users.id, externalId) : eq(users.id, "__missing__"),
      ),
    )
    .limit(1);

  if (!existingUser) {
    return null;
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      clerkUserId: null,
      authSource: "LEGACY",
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  return updatedUser ?? existingUser;
}
