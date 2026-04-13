import { Resend } from "resend";
import { DeliveryConfigurationError, getAppUrl, getResendConfig, isResendConfigured } from "./deliveryConfig";

let resendClient: Resend | null = null;

function getResendClient() {
  const { apiKey } = getResendConfig();
  if (!apiKey) {
    throw new DeliveryConfigurationError("Resend email delivery is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getFromEmail() {
  const { fromEmail } = getResendConfig();
  if (!fromEmail) {
    throw new DeliveryConfigurationError("RESEND_FROM_EMAIL is not configured.");
  }
  return fromEmail;
}

function renderEmailShell(title: string, subtitle: string, body: string, ctaLabel?: string, ctaUrl?: string) {
  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<p style="margin:24px 0 0"><a href="${ctaUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f172a;color:#fff;text-decoration:none;font-weight:600">${ctaLabel}</a></p>`
      : "";

  return `
    <div style="background:#f8fafc;padding:32px;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #e2e8f0">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b">ServiceConnect</p>
        <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15">${title}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569">${subtitle}</p>
        ${body}
        ${ctaHtml}
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b">
          If you did not request this, you can ignore this email safely.
        </p>
      </div>
    </div>
  `;
}

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  if (!isResendConfigured()) {
    throw new DeliveryConfigurationError("Resend email delivery is not configured.");
  }

  const html = renderEmailShell(
    "Your verification code",
    "Use this one-time code to continue your ServiceConnect verification.",
    `
      <div style="padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center">
        <p style="margin:0 0 10px;font-size:13px;color:#64748b">Verification code</p>
        <p style="margin:0;font-size:34px;letter-spacing:.35em;font-weight:700">${input.code}</p>
      </div>
      <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#334155">
        This code expires in ${input.expiresInMinutes} minutes.
      </p>
    `,
  );

  await getResendClient().emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: "Your ServiceConnect verification code",
    html,
    text: `Your ServiceConnect verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  firstName?: string | null;
  resetToken: string;
  resetUrl?: string;
}) {
  if (!isResendConfigured()) {
    throw new DeliveryConfigurationError("Resend email delivery is not configured.");
  }

  const resetUrl = input.resetUrl || `${getAppUrl()}/#/reset-password/${input.resetToken}`;
  const greeting = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const html = renderEmailShell(
    "Reset your password",
    "A password reset was requested for your ServiceConnect account.",
    `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">${greeting}</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#334155">
        Click the button below to choose a new password. This link expires in 1 hour and can only be used once.
      </p>
    `,
    "Reset password",
    resetUrl,
  );

  await getResendClient().emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: "Reset your ServiceConnect password",
    html,
    text: `Reset your ServiceConnect password: ${resetUrl}`,
  });
}

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  message: string;
  actionUrl?: string | null;
}) {
  if (!isResendConfigured()) return;

  const html = renderEmailShell(
    input.title,
    "You have a new update from ServiceConnect.",
    `<p style="margin:0;font-size:15px;line-height:1.7;color:#334155">${input.message}</p>`,
    input.actionUrl ? "Open ServiceConnect" : undefined,
    input.actionUrl ?? undefined,
  );

  await getResendClient().emails.send({
    from: getFromEmail(),
    to: input.to,
    subject: input.title,
    html,
    text: `${input.title}\n\n${input.message}${input.actionUrl ? `\n\n${input.actionUrl}` : ""}`,
  });
}
