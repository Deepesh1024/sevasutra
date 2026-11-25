"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { evaluate } from "@/lib/engine/evaluate";
import type { EvaluationResult, FactInput } from "@/lib/engine/types";
import { FIELD_MAP } from "@/lib/profile/fields";
import { parseFieldValue, saveUserFacts, ensurePrimaryProfile, hasConsent, grantConsent } from "@/lib/profile/service";
import { readFieldForm } from "@/components/FieldInput";
import { evaluable, getPublished } from "@/lib/schemes/repo";
import { clientIpHash, currentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { redactText } from "@/lib/redact";
import { contentOf } from "@/lib/schemes/repo";
import { isApplicant } from "@/lib/auth/roles";

export type QuickCheckState = { result?: EvaluationResult; error?: string; values?: Record<string, unknown> };

/** Guest eligibility check. Nothing is stored: the answers exist only for this request. */
export async function quickCheckAction(_prev: QuickCheckState, fd: FormData): Promise<QuickCheckState> {
  const ip = await clientIpHash();
  if (!(await rateLimit(`quick:${ip}`, 60, 3600))) return { error: "Too many checks. Please try again later." };
  const v = await getPublished(String(fd.get("schemeId") ?? ""));
  if (!v) return { error: "Scheme not found." };
  const keys = String(fd.get("keys") ?? "").split(",").filter((k) => FIELD_MAP[k]);
  const raw = readFieldForm(fd, keys);
  const input: FactInput = {};
  for (const k of keys) {
    const val = parseFieldValue(FIELD_MAP[k], raw[k]);
    if (val !== undefined) input[k] = [{ key: k, value: val, provenance: "user_entered" }];
  }
  const values = Object.fromEntries(Object.entries(input).map(([k, r]) => [k, r[0].value]));
  return { result: evaluate(evaluable(v), input, { documents: [] }), values };
}

export async function answerQuestionsAction(fd: FormData) {
  const user = await currentUser();
  const schemeId = String(fd.get("schemeId") ?? "");
  if (!user) redirect(`/login?next=/schemes/${schemeId}`);
  if (!(await hasConsent(user.id, "profile_basic"))) redirect(`/consent?next=/schemes/${schemeId}`);
  if (fd.get("consent_sensitive") === "on") await grantConsent(user.id, "profile_sensitive");
  const profileId = String(fd.get("profileId") ?? "") || (await ensurePrimaryProfile(user.id)).id;
  const keys = String(fd.get("keys") ?? "").split(",").filter((k) => FIELD_MAP[k]);
  const raw = readFieldForm(fd, keys);
  const values: Record<string, never> = {};
  for (const k of keys) {
    const v = parseFieldValue(FIELD_MAP[k], raw[k]);
    if (v !== undefined) values[k] = v as never;
  }
  await saveUserFacts(user, profileId, values);
  revalidatePath(`/schemes/${schemeId}`);
  redirect(`/schemes/${schemeId}?profile=${profileId}#eligibility`);
}

export async function toggleSaveAction(fd: FormData) {
  const user = await currentUser();
  const schemeId = String(fd.get("schemeId") ?? "");
  if (!user) redirect(`/login?next=/schemes/${schemeId}`);
  const existing = await db.savedScheme.findUnique({ where: { userId_schemeId: { userId: user.id, schemeId } } });
  if (existing) await db.savedScheme.delete({ where: { userId_schemeId: { userId: user.id, schemeId } } });
  else await db.savedScheme.create({ data: { userId: user.id, schemeId } });
  await audit({ actorId: user.id, actorType: "user", action: existing ? "scheme.unsaved" : "scheme.saved", entityType: "scheme", entityId: schemeId });
  revalidatePath(`/schemes/${schemeId}`);
  revalidatePath("/dashboard");
}

export type FeedbackState = { ok?: boolean; error?: string };

export async function feedbackAction(_prev: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const ip = await clientIpHash();
  if (!(await rateLimit(`feedback:${ip}`, 10, 3600))) return { error: "Too many reports. Please try again later." };
  const message = redactText(String(fd.get("message") ?? "").trim()).slice(0, 2000);
  const kind = ["outdated", "incorrect", "question", "other"].includes(String(fd.get("kind"))) ? String(fd.get("kind")) : "other";
  if (message.length < 5) return { error: "Please describe the problem in a few words." };
  const user = await currentUser();
  const schemeId = String(fd.get("schemeId") ?? "") || null;
  const f = await db.feedback.create({ data: { userId: user?.id ?? null, schemeId, kind, message } });
  await audit({ actorId: user?.id, actorType: user ? "user" : "guest", action: "feedback.created", entityType: "feedback", entityId: f.id, metadata: { schemeId, kind } });
  return { ok: true };
}

export async function startApplicationAction(fd: FormData) {
  const user = await currentUser();
  const schemeId = String(fd.get("schemeId") ?? "");
  if (!user) redirect(`/login?next=/schemes/${schemeId}`);
  if (!isApplicant(user)) redirect(`/login/verify-phone?next=/schemes/${schemeId}`);
  const v = await getPublished(schemeId);
  if (!v) redirect("/schemes");
  const c = contentOf(v);
  if (c.application.mode === "unavailable") redirect(`/schemes/${schemeId}`);
  const profileId = String(fd.get("profileId") ?? "") || (await ensurePrimaryProfile(user.id)).id;
  await db.profile.findFirstOrThrow({ where: { id: profileId, userId: user.id } });
  const app = await db.application.upsert({
    where: { userId_profileId_schemeId: { userId: user.id, profileId, schemeId } },
    update: {},
    create: { userId: user.id, profileId, schemeId, state: "checklist_in_progress", checklist: {} },
  });
  await audit({ actorId: user.id, actorType: "user", action: "application.started", entityType: "application", entityId: app.id, metadata: { schemeId } });
  redirect(`/applications/${app.id}`);
}
