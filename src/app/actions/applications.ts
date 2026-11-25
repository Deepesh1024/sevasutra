"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/auth/session";
import { USER_SETTABLE, type AppState, type Checklist } from "@/lib/applications";
import { contentOf, getPublished } from "@/lib/schemes/repo";
import { isApplicant } from "@/lib/auth/roles";

async function ownApp(id: string) {
  const user = await currentUser();
  if (!user || !isApplicant(user)) redirect("/login");
  const app = await db.application.findFirst({ where: { id, userId: user.id } });
  if (!app) redirect("/dashboard");
  return { user, app };
}

export async function updateChecklistAction(fd: FormData) {
  const { user, app } = await ownApp(String(fd.get("id")));
  const cl: Checklist = { docs: {}, steps: {} };
  for (const [k] of fd.entries()) {
    if (k.startsWith("doc:")) cl.docs![k.slice(4)] = true;
    if (k.startsWith("step:")) cl.steps![k.slice(5)] = true;
  }
  const v = await getPublished(app.schemeId);
  const ready = !!v && contentOf(v).documents.filter((d) => d.required).every((d) => cl.docs?.[d.type]);
  const state: AppState = ["not_started", "checklist_in_progress", "ready_to_apply"].includes(app.state) ? (ready ? "ready_to_apply" : "checklist_in_progress") : (app.state as AppState);
  await db.application.update({ where: { id: app.id }, data: { checklist: cl as never, state } });
  await audit({ actorId: user.id, actorType: "user", action: "application.checklist_updated", entityType: "application", entityId: app.id, metadata: { state } });
  revalidatePath(`/applications/${app.id}`);
}

/** Called when the applicant opens the official portal (new tab). Records the redirect — not a submission. */
export async function recordRedirectAction(id: string) {
  const { user, app } = await ownApp(id);
  if (["not_started", "checklist_in_progress", "ready_to_apply"].includes(app.state)) {
    await db.application.update({ where: { id }, data: { state: "redirected", redirectedAt: new Date() } });
  }
  await audit({ actorId: user.id, actorType: "user", action: "application.redirected", entityType: "application", entityId: id });
  revalidatePath(`/applications/${id}`);
}

export async function reportStatusAction(fd: FormData) {
  const { user, app } = await ownApp(String(fd.get("id")));
  const state = String(fd.get("state")) as AppState;
  if (!USER_SETTABLE.includes(state)) return;
  const ref = String(fd.get("externalRef") ?? "").trim().replace(/[^\w\-/]/g, "").slice(0, 40) || null;
  const renewal = String(fd.get("renewalDueAt") ?? "");
  await db.application.update({
    where: { id: app.id },
    data: {
      state: ref && state === "submitted_externally" ? "reference_received" : state,
      externalRef: ref ?? app.externalRef,
      renewalDueAt: /^\d{4}-\d{2}-\d{2}$/.test(renewal) ? new Date(renewal) : app.renewalDueAt,
    },
  });
  await audit({ actorId: user.id, actorType: "user", action: "application.status_reported", entityType: "application", entityId: app.id, metadata: { state, hasRef: !!ref } });
  await db.notification.upsert({
    where: { dedupeKey: `status:${app.id}:${state}` },
    update: {},
    create: { userId: user.id, template: "application_status", dedupeKey: `status:${app.id}:${state}`, payload: { applicationId: app.id, schemeId: app.schemeId, state } },
  });
  revalidatePath(`/applications/${app.id}`);
}
