import type { PrismaClient } from "@prisma/client";
import { enqueue } from "./queue";
import { FIELDS } from "@/lib/profile/fields";
import type { SchemeContent } from "@/lib/schemes/types";

const week = (d: Date) => `${d.getUTCFullYear()}-w${Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400_000 + 1) / 7)}`;

/** Scan state and enqueue reminders. Dedupe keys make this safe to run as often as you like. */
export async function scheduleReminders(db: PrismaClient, now = new Date()) {
  let n = 0;
  const users = await db.user.findMany({ where: { deletedAt: null, email: { not: null }, emailVerifiedAt: { not: null } } });
  const discovery = FIELDS.filter((f) => f.discovery && f.key !== "age_band").map((f) => f.key);

  for (const u of users) {
    // Profile completion (weekly at most)
    const primary = await db.profile.findFirst({ where: { userId: u.id, isPrimary: true }, include: { facts: { where: { supersededAt: null } } } });
    const have = new Set(primary?.facts.map((f) => f.key));
    if (have.has("age_band")) have.add("date_of_birth");
    if (discovery.some((k) => !have.has(k))) { await enqueue(db, u.id, "profile_completion", `profile:${u.id}:${week(now)}`, {}); n++; }

    // Saved scheme deadlines within 14 days
    const saved = await db.savedScheme.findMany({ where: { userId: u.id }, include: { scheme: { include: { currentVersion: true } } } });
    for (const s of saved) {
      const dl = s.scheme.currentVersion?.deadline;
      if (dl && dl > now && dl.getTime() - now.getTime() < 14 * 86400_000) {
        await enqueue(db, u.id, "deadline_upcoming", `deadline:${u.id}:${s.schemeId}:${dl.toISOString().slice(0, 10)}`, { schemeId: s.schemeId });
        n++;
      }
    }

    // Applications: missing documents (weekly) and renewals (30 days ahead)
    const apps = await db.application.findMany({ where: { userId: u.id } });
    for (const a of apps) {
      if (a.state === "checklist_in_progress") {
        const v = await db.schemeVersion.findFirst({ where: { schemeId: a.schemeId, status: "published" } });
        const c = v?.content as unknown as SchemeContent | undefined;
        const docs = (a.checklist as { docs?: Record<string, boolean> }).docs ?? {};
        if (c?.documents.some((d) => d.required && !docs[d.type])) { await enqueue(db, u.id, "missing_documents", `docs:${a.id}:${week(now)}`, { applicationId: a.id }); n++; }
      }
      if (a.renewalDueAt && a.renewalDueAt > now && a.renewalDueAt.getTime() - now.getTime() < 30 * 86400_000) {
        await enqueue(db, u.id, "renewal_due", `renewal:${a.id}:${a.renewalDueAt.toISOString().slice(0, 10)}`, { applicationId: a.id }); n++;
      }
    }
  }
  return n;
}
