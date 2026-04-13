import twilio from "twilio";
import { DeliveryConfigurationError, getOtpDefaultCountryCode, getTwilioVerifyConfig, isTwilioVerifyConfigured } from "./deliveryConfig";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  const { accountSid, authToken } = getTwilioVerifyConfig();
  if (!accountSid || !authToken) {
    throw new DeliveryConfigurationError("Twilio Verify is not configured.");
  }

  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

function getVerifyServiceSid() {
  const { serviceSid } = getTwilioVerifyConfig();
  if (!serviceSid) {
    throw new DeliveryConfigurationError("TWILIO_VERIFY_SERVICE_SID is not configured.");
  }
  return serviceSid;
}

export function normalizePhoneNumber(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Phone number is required.");
  }

  const compact = trimmed.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) {
    return compact;
  }

  if (compact.startsWith("00")) {
    return `+${compact.slice(2)}`;
  }

  if (compact.startsWith("0")) {
    return `${getOtpDefaultCountryCode()}${compact.slice(1)}`;
  }

  return `${getOtpDefaultCountryCode()}${compact}`;
}

export async function sendPhoneVerificationCode(rawPhone: string) {
  if (!isTwilioVerifyConfigured()) {
    throw new DeliveryConfigurationError("Twilio Verify is not configured.");
  }

  const to = normalizePhoneNumber(rawPhone);
  await getTwilioClient().verify.v2.services(getVerifyServiceSid()).verifications.create({
    to,
    channel: "sms",
  });
  return to;
}

export async function checkPhoneVerificationCode(rawPhone: string, code: string) {
  if (!isTwilioVerifyConfigured()) {
    throw new DeliveryConfigurationError("Twilio Verify is not configured.");
  }

  const to = normalizePhoneNumber(rawPhone);
  const result = await getTwilioClient().verify.v2.services(getVerifyServiceSid()).verificationChecks.create({
    to,
    code,
  });

  return result.status === "approved";
}
