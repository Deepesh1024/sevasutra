"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/auth/session";
import { FIELD_MAP, FIELDS } from "@/lib/profile/fields";
import { deleteFact, grantConsent, hasConsent, parseFieldValue, saveUserFacts, withdrawConsent } from "@/lib/profile/service";
import { readFieldForm } from "@/components/FieldInput";
import { CONSENTS, type ConsentPurpose } from "@/lib/consent";
import type { FactValue } from "@/lib/engine/types";
import { isApplicant } from "@/lib/auth/roles";

function safeNext(n: FormDataEntryValue | null, d = "/profile") {
  const s = typeof n === "string" ? n : d;
  return s.startsWith("/") && !s.startsWith("//") ? s : d;
}

export async function grantConsentsAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const next = safeNext(fd.get("next"));
  for (const c of CONSENTS) {
    if (c.purpose === "guardian_minor") continue;
    if (fd.get(c.purpose) === "on" && !(await hasConsent(user.id, c.purpose))) await grantConsent(user.id, c.purpose);
  }
  if (!(await hasConsent(user.id, "profile_basic"))) redirect(`/consent?next=${encodeURIComponent(next)}&error=required`);
  redirect(next);
}

export async function withdrawConsentAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const purpose = String(fd.get("purpose")) as ConsentPurpose;
  if (!CONSENTS.some((c) => c.purpose === purpose)) return;
  await withdrawConsent(user.id, purpose);
  if (purpose === "reminders_email") {
    const prefs = (user.notificationPrefs as Record<string, boolean>) ?? {};
    await db.user.update({ where: { id: user.id }, data: { notificationPrefs: { ...prefs, email: false } } });
  }
  revalidatePath("/account");
}

export async function saveProfileAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/profile");
  if (!(await hasConsent(user.id, "profile_basic"))) redirect("/consent?next=/profile");
  const profileId = String(fd.get("profileId"));
  const section = String(fd.get("section"));
  const keys = FIELDS.filter((f) => f.section === section).map((f) => f.key);
  const raw = readFieldForm(fd, keys);
  const values: Record<string, FactValue> = {};
  for (const k of keys) {
    const v = parseFieldValue(FIELD_MAP[k], raw[k]);
    if (v !== undefined) values[k] = v;
  }
  await saveUserFacts(user, profileId, values);
  revalidatePath("/profile");
  redirect(`/profile?profile=${profileId}&saved=${section}#sec-${section}`);
}

/** Bound with the field key (`deleteAnswerAction.bind(null, key)`): React overrides `name` on formAction buttons. */
export async function deleteAnswerAction(key: string, fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const profileId = String(fd.get("profileId"));
  // deleteFact checks the profile belongs to this user; only known field keys are accepted.
  if (!FIELD_MAP[key]) return;
  await deleteFact(user, profileId, key);
  revalidatePath("/profile");
}

export async function addMemberAction(fd: FormData) {
  const user = await currentUser();
  if (!user || !isApplicant(user)) redirect("/login/verify-phone?next=/profile");
  const label = String(fd.get("label") ?? "").trim().slice(0, 40) || "Family member";
  const relationship = ["spouse", "child", "parent", "sibling", "other"].includes(String(fd.get("relationship"))) ? String(fd.get("relationship")) : "other";
  const isMinor = fd.get("minor") === "on";
  if (isMinor && fd.get("guardian_consent") !== "on") redirect("/profile?error=guardian#members");
  const count = await db.profile.count({ where: { userId: user.id } });
  if (count >= 10) redirect("/profile?error=members#members");
  const p = await db.profile.create({ data: { userId: user.id, label, relationship, isPrimary: false, guardianConsentAt: isMinor ? new Date() : null } });
  if (isMinor) await grantConsent(user.id, "guardian_minor", p.id);
  await audit({ actorId: user.id, actorType: "user", action: "profile.member_added", entityType: "profile", entityId: p.id, metadata: { relationship, minor: isMinor } });
  redirect(`/profile?profile=${p.id}`);
}

export async function removeMemberAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(fd.get("profileId"));
  const p = await db.profile.findFirst({ where: { id, userId: user.id, isPrimary: false } });
  if (p) {
    await db.profile.delete({ where: { id } });
    await audit({ actorId: user.id, actorType: "user", action: "profile.member_removed", entityType: "profile", entityId: id });
  }
  redirect("/profile#members");
}
