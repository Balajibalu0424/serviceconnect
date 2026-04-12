export type NotificationCategoryKey =
  | "quotes"
  | "bookings"
  | "messages"
  | "jobUpdates"
  | "reviews"
  | "leads"
  | "system";

export type NotificationPreferenceRole = "CUSTOMER" | "PROFESSIONAL" | "ADMIN" | "SUPPORT" | string;

export interface NotificationPreferenceCategories {
  quotes: boolean;
  bookings: boolean;
  messages: boolean;
  jobUpdates: boolean;
  reviews: boolean;
  leads: boolean;
  system: boolean;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  categories: NotificationPreferenceCategories;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  push: true,
  categories: {
    quotes: true,
    bookings: true,
    messages: true,
    jobUpdates: true,
    reviews: true,
    leads: true,
    system: true,
  },
};

export function normalizeNotificationPreferences(
  raw?: Partial<NotificationPreferences> | null,
  _role?: NotificationPreferenceRole,
): NotificationPreferences {
  const categories: Partial<NotificationPreferenceCategories> =
    raw?.categories && typeof raw.categories === "object" ? raw.categories : {};

  return {
    email: raw?.email ?? DEFAULT_NOTIFICATION_PREFERENCES.email,
    sms: raw?.sms ?? DEFAULT_NOTIFICATION_PREFERENCES.sms,
    push: raw?.push ?? DEFAULT_NOTIFICATION_PREFERENCES.push,
    categories: {
      quotes: categories.quotes ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.quotes,
      bookings: categories.bookings ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.bookings,
      messages: categories.messages ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.messages,
      jobUpdates: categories.jobUpdates ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.jobUpdates,
      reviews: categories.reviews ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.reviews,
      leads: categories.leads ?? DEFAULT_NOTIFICATION_PREFERENCES.categories.leads,
      system: true,
    },
  };
}
