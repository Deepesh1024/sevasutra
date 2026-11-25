"use server";

import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { clientIpHash, createSession, currentUser, destroySession, getSession } from "@/lib/auth/session";
import { googleConfigured, verifyGoogleIdToken } from "@/lib/auth/google";
import { decryptString, encryptString, signToken, verifyToken } from "@/lib/crypto";
import { ensurePrimaryProfile } from "@/lib/profile/service";

export type OtpChannel = "phone" | "email";

export type OtpState =
  | { stage: "phone"; error?: string }
  | { stage: "code"; challengeId: string; phone: string; channel: OtpChannel; devCode?: string; error?: string; linking: boolean }
  | { stage: "conflict"; mergeToken: string; maskedPhone: string }
  | { stage: "done"; next: string };

const ERRORS: Record<string, string> = {
  invalid_phone: "Enter a valid 10-digit Indian mobile number.",
  invalid_email: "Enter a valid email address.",
  rate_limited: "Too many requests. Please try again in an hour.",
  cooldown: "Please wait 30 seconds before requesting another code.",
  locked: "Too many wrong attempts. Sign-in is locked for 30 minutes.",
  provider_error: "We couldn't send the code right now. Please try again later.",
  invalid: "That code is not correct.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many wrong attempts. Request a new code after 30 minutes.",
};

function safeNext(n: FormDataEntryValue | null): string {
  const s = typeof n === "string" ? n : "/dashboard";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

const channelOf = (fd: FormData): OtpChannel => (fd.get("channel") === "email" ? "email" : "phone");
const emailOtpGrantsApplicant = () => process.env.EMAIL_OTP_GRANTS_APPLICANT !== "false";
const maskEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);

/** Single state machine for the identifier → code → done flow (works with or without JavaScript). */
export async function otpFlowAction(prev: OtpState, fd: FormData): Promise<OtpState> {
  const steps = fd.getAll("step");
  if (steps.includes("reset")) return { stage: "phone" };
  const step = steps[0];
  if (step === "verify") return verifyOtpAction(prev, fd);
  return requestOtpAction(prev, fd);
}

export async function requestOtpAction(_prev: OtpState, fd: FormData): Promise<OtpState> {
  const channel = channelOf(fd);
  const raw = String(fd.get(channel === "email" ? "email" : "phone") ?? "");
  const linking = fd.get("linking") === "1";
  if (linking && fd.get("confirmLink") !== "on") return { stage: "phone", error: `Please confirm that you want to link this ${channel === "email" ? "email address" : "mobile number"} to your account.` };
  const r = await requestOtp(raw, linking ? "link" : "login", await clientIpHash(), channel);
  if (!r.ok) return { stage: "phone", error: ERRORS[r.error] };
  return { stage: "code", challengeId: r.challengeId, phone: r.identifier, channel, devCode: r.devCode, linking };
}

export async function verifyOtpAction(prev: OtpState, fd: FormData): Promise<OtpState> {
  if (prev.stage !== "code") return { stage: "phone" };
  const code = String(fd.get("code") ?? "").trim();
  const ip = await clientIpHash();
  const channel = prev.channel ?? "phone";
  const r = await verifyOtp(prev.challengeId, prev.phone, code, ip, channel);
  if (!r.ok) return { ...prev, error: ERRORS[r.error] };
  const next = safeNext(fd.get("next"));
  const id = r.identifier;
  const me = await currentUser();

  // Who already owns this identifier?
  let existing = channel === "phone"
    ? await db.user.findUnique({ where: { phoneE164: id } })
    : (await db.identity.findUnique({ where: { provider_subject: { provider: "email", subject: id } }, include: { user: true } }))?.user ?? null;
  // A Google account with the same address is the same person: OTP proved inbox ownership.
  if (!existing && channel === "email") {
    existing = await db.user.findFirst({ where: { email: id, deletedAt: null, identities: { some: { provider: "google" } } } });
  }

  if (prev.linking && me) {
    if (existing && existing.id !== me.id) {
      const mergeToken = signToken(JSON.stringify({ from: me.id, to: existing.id }), 600, "merge");
      await audit({ actorId: me.id, actorType: "user", action: "account.link_conflict", entityType: "user", entityId: me.id, metadata: { channel }, ipHash: ip });
      return { stage: "conflict", mergeToken, maskedPhone: channel === "email" ? maskEmail(id) : id.replace(/^(\+91)(\d{2})\d{4}(\d{4})$/, "$1 $2xxxx$3") };
    }
    await linkIdentifier(me.id, me.role, channel, id);
    await audit({ actorId: me.id, actorType: "user", action: `account.${channel}_linked`, entityType: "user", entityId: me.id, ipHash: ip });
    return { stage: "done", next };
  }

  let user = existing;
  if (!user) {
    user = channel === "phone"
      ? await db.user.create({ data: { phoneE164: id, phoneVerifiedAt: new Date(), role: "applicant" } })
      : await db.user.create({ data: { email: id, emailVerifiedAt: new Date(), role: emailOtpGrantsApplicant() ? "applicant" : "explorer" } });
    await db.identity.create({ data: { userId: user.id, provider: channel, subject: id, email: channel === "email" ? id : undefined } });
    await audit({ actorId: user.id, actorType: "user", action: "account.created", entityType: "user", entityId: user.id, metadata: { via: channel }, ipHash: ip });
  } else if (user.deletedAt) {
    return { ...prev, error: "This account was deleted. Contact support to restore it." };
  } else if (channel === "email") {
    await linkIdentifier(user.id, user.role, "email", id);
  }
  await destroySession();
  await createSession(user.id);
  await ensurePrimaryProfile(user.id);
  await audit({ actorId: user.id, actorType: "user", action: "auth.login", entityType: "user", entityId: user.id, metadata: { via: channel }, ipHash: ip });
  if (user.role === "admin" || user.role === "support") return { stage: "done", next: `/admin/mfa?next=${encodeURIComponent(next.startsWith("/admin") ? next : "/admin")}` };
  return { stage: "done", next };
}

async function linkIdentifier(userId: string, role: string, channel: OtpChannel, id: string) {
  const upgrade = role === "explorer" && (channel === "phone" || emailOtpGrantsApplicant()) ? { role: "applicant" } : {};
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: channel === "phone" ? { phoneE164: id, phoneVerifiedAt: new Date(), ...upgrade } : { email: id, emailVerifiedAt: new Date(), ...upgrade },
    }),
    db.identity.upsert({
      where: { provider_subject: { provider: channel, subject: id } },
      update: {},
      create: { userId, provider: channel, subject: id, email: channel === "email" ? id : undefined },
    }),
  ]);
}

/** Merge an explorer account into the existing account that owns the verified phone/email, after explicit confirmation. */
export async function confirmMergeAction(fd: FormData) {
  const tok = verifyToken(String(fd.get("mergeToken") ?? ""), "merge");
  if (!tok || fd.get("confirm") !== "on") redirect("/login/verify-phone?error=merge");
  const { from, to } = JSON.parse(tok) as { from: string; to: string };
  const me = await currentUser();
  if (!me || me.id !== from) redirect("/login");
  await db.$transaction(async (tx) => {
    await tx.identity.updateMany({ where: { userId: from, provider: "google" }, data: { userId: to } });
    const saved = await tx.savedScheme.findMany({ where: { userId: from } });
    for (const s of saved) await tx.savedScheme.upsert({ where: { userId_schemeId: { userId: to, schemeId: s.schemeId } }, update: {}, create: { userId: to, schemeId: s.schemeId } });
    await tx.user.update({ where: { id: from }, data: { deletedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: from }, data: { revokedAt: new Date() } });
  });
  await audit({ actorId: to, actorType: "user", action: "account.merged", entityType: "user", entityId: to, metadata: { from } });
  await createSession(to);
  redirect("/dashboard");
}

export async function googleSignInAction(credential: string, next = "/schemes"): Promise<{ ok: boolean; error?: string; next?: string }> {
  if (!googleConfigured()) return { ok: false, error: "Google sign-in is not configured." };
  try {
    const g = await verifyGoogleIdToken(credential);
    return { ok: true, next: await signInGoogleIdentity(g.sub, g.email, g.name, safeNext(next)) };
  } catch {
    return { ok: false, error: "Google sign-in failed. Please try again." };
  }
}

/** Development-only stand-in for Google sign-in when GOOGLE_CLIENT_ID is not configured. */
export async function devGoogleSignInAction(fd: FormData) {
  if (process.env.NODE_ENV === "production" || googleConfigured()) redirect("/login");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/login?error=email");
  const next = await signInGoogleIdentity(`dev:${email}`, email, email.split("@")[0], safeNext(fd.get("next")));
  redirect(next);
}

async function signInGoogleIdentity(sub: string, email: string | undefined, name: string | undefined, next: string): Promise<string> {
  const ident = await db.identity.findUnique({ where: { provider_subject: { provider: "google", subject: sub } }, include: { user: true } });
  let userId = ident?.user && !ident.user.deletedAt ? ident.userId : null;
  if (!userId) {
    // Google never grants application privileges: new users start as explorers.
    const u = await db.user.create({ data: { role: "explorer", email, displayName: name } });
    await db.identity.create({ data: { userId: u.id, provider: "google", subject: sub, email } });
    await audit({ actorId: u.id, actorType: "user", action: "account.created", entityType: "user", entityId: u.id, metadata: { via: "google" } });
    userId = u.id;
  }
  await destroySession();
  await createSession(userId);
  await audit({ actorId: userId, actorType: "user", action: "auth.login", entityType: "user", entityId: userId, metadata: { via: "google" } });
  return next;
}

export async function logout() {
  const u = await currentUser();
  await destroySession();
  if (u) await audit({ actorId: u.id, actorType: "user", action: "auth.logout", entityType: "user", entityId: u.id });
  redirect("/");
}

// ───────────── Staff MFA (TOTP) ─────────────

export type MfaState = { error?: string; enrolSecret?: string; otpauth?: string };

export async function mfaAction(prev: MfaState, fd: FormData): Promise<MfaState> {
  const s = await getSession();
  if (!s?.user || (s.user.role !== "admin" && s.user.role !== "support")) redirect("/login");
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(fd.get("next"));
  let secret: string | null = s.user.totpSecretEnc ? decryptString(s.user.totpSecretEnc) : null;
  const enrolling = !s.user.totpEnabledAt;
  if (enrolling) {
    secret = String(fd.get("secret") ?? "") || null;
    if (!secret) {
      const fresh = authenticator.generateSecret();
      return { enrolSecret: fresh, otpauth: authenticator.keyuri(s.user.phoneE164 ?? s.user.id, "SevaSutra Admin", fresh) };
    }
  }
  if (!secret || !authenticator.check(code, secret)) {
    await audit({ actorId: s.user.id, actorType: "admin", action: "mfa.failed", entityType: "user", entityId: s.user.id });
    return { ...prev, error: "That code is not correct. Check your authenticator app's time is accurate." };
  }
  if (enrolling) await db.user.update({ where: { id: s.user.id }, data: { totpSecretEnc: encryptString(secret), totpEnabledAt: new Date() } });
  await db.session.update({ where: { id: s.id }, data: { mfaVerified: true } });
  await audit({ actorId: s.user.id, actorType: "admin", action: enrolling ? "mfa.enrolled" : "mfa.verified", entityType: "user", entityId: s.user.id });
  redirect(next.startsWith("/admin") ? next : "/admin");
}
