"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentUser, destroySession, getSession } from "@/lib/auth/session";
import { signToken } from "@/lib/crypto";
import { enqueue } from "@/lib/notify/queue";
import { grantConsent, hasConsent } from "@/lib/profile/service";
import { deleteStored } from "@/lib/documents/storage";
import { rateLimit } from "@/lib/ratelimit";

export async function setEmailAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) redirect("/account?error=email#notifications");
  if (!(await rateLimit(`emailverify:${user.id}`, 5, 3600))) redirect("/account?error=rate#notifications");
  await db.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: null } });
  const token = signToken(JSON.stringify({ uid: user.id, email }), 86400, "email");
  await enqueue(db, user.id, "email_verify", `verify:${user.id}:${email}:${Date.now()}`, { verifyUrl: `${process.env.APP_URL}/api/verify-email?t=${encodeURIComponent(token)}` });
  // Deliver verification mail immediately (it bypasses quiet hours).
  const { processDue } = await import("@/lib/notify/queue");
  await processDue(db);
  await audit({ actorId: user.id, actorType: "user", action: "account.email_set", entityType: "user", entityId: user.id });
  redirect("/account?sent=1#notifications");
}

export async function savePrefsAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const prefs = {
    email: fd.get("email") === "on",
    deadlines: fd.get("deadlines") === "on",
    documents: fd.get("documents") === "on",
    profile: fd.get("profile") === "on",
    status: fd.get("status") === "on",
    corrections: fd.get("corrections") === "on",
  };
  if (prefs.email && !(await hasConsent(user.id, "reminders_email"))) await grantConsent(user.id, "reminders_email");
  await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
  await audit({ actorId: user.id, actorType: "user", action: "account.prefs_updated", entityType: "user", entityId: user.id, metadata: prefs });
  revalidatePath("/account");
  redirect("/account?saved=prefs#notifications");
}

export async function revokeSessionAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(fd.get("sessionId"));
  await db.session.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } });
  await audit({ actorId: user.id, actorType: "user", action: "session.revoked", entityType: "session", entityId: id });
  revalidatePath("/account");
}

export async function revokeOtherSessionsAction() {
  const s = await getSession();
  if (!s?.user) redirect("/login");
  await db.session.updateMany({ where: { userId: s.user.id, id: { not: s.id }, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit({ actorId: s.user.id, actorType: "user", action: "session.revoked_others", entityType: "user", entityId: s.user.id });
  revalidatePath("/account");
}

/** Erasure: removes profile facts, documents (files + rows), consents, saved items, applications and sessions. */
export async function deleteAccountAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (String(fd.get("confirm")).trim().toUpperCase() !== "DELETE") redirect("/account?error=confirm#delete");
  const docs = await db.document.findMany({ where: { userId: user.id } });
  for (const d of docs) await deleteStored(d.storageKey);
  await db.$transaction([
    db.document.deleteMany({ where: { userId: user.id } }),
    db.profile.deleteMany({ where: { userId: user.id } }),
    db.evaluation.deleteMany({ where: { userId: user.id } }),
    db.application.deleteMany({ where: { userId: user.id } }),
    db.savedScheme.deleteMany({ where: { userId: user.id } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.identity.deleteMany({ where: { userId: user.id } }),
    db.consent.updateMany({ where: { userId: user.id, withdrawnAt: null }, data: { withdrawnAt: new Date() } }),
    db.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    db.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), phoneE164: null, email: null, displayName: null, totpSecretEnc: null } }),
  ]);
  await audit({ actorId: user.id, actorType: "user", action: "account.deleted", entityType: "user", entityId: user.id, metadata: { documents: docs.length } });
  await destroySession();
  redirect("/?deleted=1");
}
