import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { hmac, randomToken, sha256 } from "@/lib/crypto";
import type { User } from "@prisma/client";
import { isApplicant } from "@/lib/auth/roles";

export const SESSION_COOKIE = "sh_session";
const SESSION_DAYS = 14;
const ADMIN_SESSION_HOURS = 8;

export type Role = "explorer" | "applicant" | "support" | "admin";

export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return hmac(ip, "ip").slice(0, 32);
}

export async function createSession(userId: string, opts: { mfaVerified?: boolean } = {}) {
  const token = randomToken();
  const h = await headers();
  const user = await db.user.findUnique({ where: { id: userId } });
  const privileged = user?.role === "admin" || user?.role === "support";
  const ttlMs = privileged ? ADMIN_SESSION_HOURS * 3600_000 : SESSION_DAYS * 86400_000;
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      mfaVerified: opts.mfaVerified ?? false,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
      ipHash: await clientIpHash(),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.revokedAt || s.expiresAt < new Date() || !s.user || s.user.deletedAt) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  return s;
});

export async function currentUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  (await cookies()).delete(SESSION_COOKIE);
}

export async function requireUser(next = "/"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Verified applicants only (phone OTP verified). Explorers are sent to verify their phone. */
export async function requireApplicant(next = "/"): Promise<User> {
  const u = await requireUser(next);
  if (!isApplicant(u)) redirect(`/login/verify-phone?next=${encodeURIComponent(next)}`);
  return u;
}

/** Staff pages: role check + MFA verified on this session. */
export async function requireStaff(roles: Role[] = ["admin"], next = "/admin"): Promise<User> {
  const s = await getSession();
  if (!s?.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!roles.includes(s.user.role as Role)) redirect("/?error=forbidden");
  if (!s.mfaVerified) redirect(`/admin/mfa?next=${encodeURIComponent(next)}`);
  return s.user;
}

export const isStaff = (u: User | null) => !!u && (u.role === "admin" || u.role === "support");
