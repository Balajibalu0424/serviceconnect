import type { VerificationChannel } from "@shared/onboarding";

export class DeliveryConfigurationError extends Error {}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getAppUrl() {
  return readEnv("APP_URL") || "https://codebasefull.vercel.app";
}

export function getOtpDefaultCountryCode() {
  return readEnv("OTP_DEFAULT_COUNTRY_CODE") || "+353";
}

export function getOtpMasterCode() {
  // TEMPORARY: master fallback "123456" remains active in production until a
  // real OTP provider (Twilio Verify or equivalent) is wired end-to-end.
  // Revert to the production-null variant once providers are live.
  return readEnv("OTP_MASTER_CODE") || "123456";
}

export function isProductionEnv() {
  return (process.env.NODE_ENV || "").toLowerCase() === "production";
}

export function getResendConfig() {
  return {
    apiKey: readEnv("RESEND_API_KEY"),
    fromEmail: readEnv("RESEND_FROM_EMAIL"),
  };
}

export function isResendConfigured() {
  const config = getResendConfig();
  return Boolean(config.apiKey && config.fromEmail);
}

export function getTwilioVerifyConfig() {
  return {
    accountSid: readEnv("TWILIO_ACCOUNT_SID"),
    authToken: readEnv("TWILIO_AUTH_TOKEN"),
    serviceSid: readEnv("TWILIO_VERIFY_SERVICE_SID"),
  };
}

export function isTwilioVerifyConfigured() {
  const config = getTwilioVerifyConfig();
  return Boolean(config.accountSid && config.authToken && config.serviceSid);
}

export function isUploadConfigured() {
  return Boolean(readEnv("BLOB_READ_WRITE_TOKEN"));
}

export function isExplicitOtpFallbackEnabled() {
  // TEMPORARY: honored in production too until real OTP providers are wired.
  return readEnv("OTP_ALLOW_DEV_FALLBACK") === "true";
}

export function isOtpMasterCodeEnabled() {
  // TEMPORARY: master fallback remains enabled in production until real OTP
  // providers are wired. Set OTP_MASTER_CODE_ENABLED=false to turn it off.
  return readEnv("OTP_MASTER_CODE_ENABLED") !== "false";
}

export function canUseOtpFallback(channel?: VerificationChannel) {
  // TEMPORARY: production falls back to the master code until real OTP
  // providers are configured. Remove this branch (restore the original
  // "if (isProductionEnv()) return false;" guard) once Twilio Verify or an
  // equivalent provider is live end-to-end.
  if (isExplicitOtpFallbackEnabled()) {
    return true;
  }

  if (isOtpMasterCodeEnabled()) {
    return true;
  }

  if (channel === "EMAIL") return !isResendConfigured();
  if (channel === "PHONE") return !isTwilioVerifyConfigured();
  return !isResendConfigured() || !isTwilioVerifyConfigured();
}
