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
  return readEnv("OTP_ALLOW_DEV_FALLBACK") === "true";
}

export function canUseOtpFallback() {
  return process.env.NODE_ENV !== "production" || isExplicitOtpFallbackEnabled();
}
