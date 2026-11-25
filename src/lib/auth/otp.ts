import { db } from "@/lib/db";
import { hmac, randomDigits, safeEqual } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { audit, log } from "@/lib/audit";
import { maskPhone } from "@/lib/redact";
import { mailer } from "@/lib/notify/mailer";

// ───────────── Provider abstraction ─────────────
// Business logic never talks to an SMS gateway or mail server directly. OTP codes are never logged.

export type OtpChannel = "phone" | "email";

export interface OtpProvider {
  readonly name: string;
  send(to: string, code: string): Promise<{ ok: boolean; devCode?: string }>;
}

class DevSmsProvider implements OtpProvider {
  readonly name = "dev-sms";
  async send(phoneE164: string, code: string) {
    // The code is returned for on-screen display in development only. It is never logged.
    log("info", "otp.dev.sent", { to: maskPhone(phoneE164) });
    return { ok: true, devCode: process.env.NODE_ENV === "production" ? undefined : code };
  }
}

/** Production SMS adapter shape (not wired: needs provider credentials and DLT template approval). */
class HttpSmsOtpProvider implements OtpProvider {
  readonly name = "http_sms";
  async send(): Promise<{ ok: boolean }> {
    throw new Error("SMS provider not configured. Set OTP_PROVIDER=dev for local development.");
  }
}

/** Email OTP through the configured mailer (SMTP, e.g. Gmail with an app password). */
class EmailOtpProvider implements OtpProvider {
  readonly name = process.env.SMTP_URL ? "email-smtp" : "email-dev-mailbox";
  async send(email: string, code: string) {
    const m = mailer(db);
    await m.send({
      to: email,
      // Subject carries no code or personal detail.
      subject: "Your SevaSutra sign-in code",
      text: `Your SevaSutra sign-in code is ${code}\n\nIt is valid for 5 minutes. Never share this code with anyone — SevaSutra staff will never ask for it.\n\nIf you did not try to sign in, you can ignore this email.\n\n—\nSevaSutra is an independent assistant, not a government website.`,
    });
    log("info", "otp.email.sent", { provider: this.name });
    // Without real SMTP the mail goes to the dev mailbox, so show the code on screen in development.
    return { ok: true, devCode: !process.env.SMTP_URL && process.env.NODE_ENV !== "production" ? code : undefined };
  }
}

export function otpProvider(channel: OtpChannel = "phone"): OtpProvider {
  if (channel === "email") return new EmailOtpProvider();
  if (process.env.OTP_PROVIDER === "http_sms") return new HttpSmsOtpProvider();
  if (process.env.NODE_ENV === "production" && process.env.OTP_PROVIDER === "dev" && process.env.ALLOW_DEV_OTP_IN_PROD !== "true") {
    throw new Error("Dev OTP provider is disabled in production");
  }
  return new DevSmsProvider();
}

// ───────────── Policy ─────────────

export const OTP_POLICY = {
  length: 6,
  ttlSeconds: 300,
  maxAttempts: 5,
  resendCooldownSeconds: 30,
  perIdentifierPerHour: 5,
  perIpPerHour: 20,
  lockoutMinutes: 30,
};

export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

export function normaliseEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) ? e : null;
}

export function normaliseIdentifier(channel: OtpChannel, raw: string) {
  return channel === "email" ? normaliseEmail(raw) : normaliseIndianMobile(raw);
}

// Phone hashes keep their original key so existing challenges stay valid.
const idHash = (channel: OtpChannel, id: string) => hmac(id, channel === "email" ? "email-otp" : "phone");

export type RequestOtpResult =
  | { ok: true; challengeId: string; devCode?: string; expiresInSeconds: number; identifier: string }
  | { ok: false; error: "invalid_phone" | "invalid_email" | "rate_limited" | "cooldown" | "locked" | "provider_error" };

export async function requestOtp(raw: string, purpose: "login" | "link", ipHash: string | null, channel: OtpChannel = "phone"): Promise<RequestOtpResult> {
  const id = normaliseIdentifier(channel, raw);
  if (!id) return { ok: false, error: channel === "email" ? "invalid_email" : "invalid_phone" };
  const ph = idHash(channel, id);

  const recentLock = await db.otpChallenge.findFirst({
    where: { phoneHash: ph, lockedAt: { gte: new Date(Date.now() - OTP_POLICY.lockoutMinutes * 60_000) } },
  });
  if (recentLock) return { ok: false, error: "locked" };

  const last = await db.otpChallenge.findFirst({ where: { phoneHash: ph }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < OTP_POLICY.resendCooldownSeconds * 1000) return { ok: false, error: "cooldown" };

  const okId = await rateLimit(`otp:${channel}:${ph}`, OTP_POLICY.perIdentifierPerHour, 3600);
  const okIp = ipHash ? await rateLimit(`otp:ip:${ipHash}`, OTP_POLICY.perIpPerHour, 3600) : true;
  if (!okId || !okIp) {
    await audit({ actorType: "guest", action: "otp.rate_limited", entityType: channel, entityId: ph.slice(0, 16), ipHash });
    return { ok: false, error: "rate_limited" };
  }

  const code = randomDigits(OTP_POLICY.length);
  const challenge = await db.otpChallenge.create({
    data: {
      phoneHash: ph,
      codeHash: hmac(`${ph}:${code}`, "otp"),
      purpose: `${channel}:${purpose}`,
      maxAttempts: OTP_POLICY.maxAttempts,
      expiresAt: new Date(Date.now() + OTP_POLICY.ttlSeconds * 1000),
      ipHash,
    },
  });
  // Invalidate earlier unconsumed challenges for this identifier.
  await db.otpChallenge.updateMany({ where: { phoneHash: ph, id: { not: challenge.id }, consumedAt: null }, data: { consumedAt: new Date() } });

  try {
    const provider = otpProvider(channel);
    const sent = await provider.send(id, code);
    await audit({ actorType: "guest", action: "otp.sent", entityType: "otp_challenge", entityId: challenge.id, metadata: { purpose, channel, provider: provider.name }, ipHash });
    return { ok: true, challengeId: challenge.id, devCode: sent.devCode, expiresInSeconds: OTP_POLICY.ttlSeconds, identifier: id };
  } catch (e) {
    log("error", "otp.provider_error", { channel, error: String(e).slice(0, 200) });
    await db.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: "provider_error" };
  }
}

export type VerifyOtpResult = { ok: true; identifier: string; phone: string } | { ok: false; error: "invalid" | "expired" | "locked" | "too_many_attempts" };

export async function verifyOtp(challengeId: string, raw: string, code: string, ipHash: string | null, channel: OtpChannel = "phone"): Promise<VerifyOtpResult> {
  const id = normaliseIdentifier(channel, raw);
  if (!id) return { ok: false, error: "invalid" };
  const ph = idHash(channel, id);
  const c = await db.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!c || c.phoneHash !== ph || c.consumedAt) return { ok: false, error: "invalid" };
  if (c.lockedAt) return { ok: false, error: "locked" };
  if (c.expiresAt < new Date()) return { ok: false, error: "expired" };

  // Count the attempt before comparing (prevents parallel brute force).
  const updated = await db.otpChallenge.update({ where: { id: c.id }, data: { attempts: { increment: 1 } } });
  if (updated.attempts > c.maxAttempts) {
    await db.otpChallenge.update({ where: { id: c.id }, data: { lockedAt: new Date() } });
    await audit({ actorType: "guest", action: "otp.locked", entityType: "otp_challenge", entityId: c.id, ipHash });
    return { ok: false, error: "too_many_attempts" };
  }
  const ok = /^\d{6}$/.test(code) && safeEqual(c.codeHash, hmac(`${ph}:${code}`, "otp"));
  if (!ok) {
    await audit({ actorType: "guest", action: "otp.failed", entityType: "otp_challenge", entityId: c.id, metadata: { attempt: updated.attempts, channel }, ipHash });
    return { ok: false, error: "invalid" };
  }
  await db.otpChallenge.update({ where: { id: c.id }, data: { consumedAt: new Date() } });
  return { ok: true, identifier: id, phone: id };
}
