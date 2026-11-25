import type { PrismaClient, Notification, User } from "@prisma/client";
import { signToken } from "@/lib/crypto";
import { mailer as getMailer, type Mailer } from "./mailer";

// Email reminders. Subjects never contain sensitive details; bodies link to pages that require sign-in.

export const TEMPLATES = [
  "profile_completion", "missing_documents", "deadline_upcoming", "deadline_changed", "renewal_due", "application_status", "content_correction", "email_verify",
] as const;
export type Template = (typeof TEMPLATES)[number];

const PREF_FOR: Record<Template, string | null> = {
  profile_completion: "profile", missing_documents: "documents", deadline_upcoming: "deadlines", deadline_changed: "deadlines",
  renewal_due: "deadlines", application_status: "status", content_correction: "corrections", email_verify: null,
};

const SUBJECT: Record<Template, string> = {
  profile_completion: "SevaSutra: a few questions could unlock more schemes",
  missing_documents: "SevaSutra: documents to get ready",
  deadline_upcoming: "SevaSutra: a saved scheme has an upcoming deadline",
  deadline_changed: "SevaSutra: a saved scheme's deadline changed",
  renewal_due: "SevaSutra: renewal reminder",
  application_status: "SevaSutra: your application tracker was updated",
  content_correction: "SevaSutra: an earlier eligibility result has changed",
  email_verify: "SevaSutra: confirm your email address",
};

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export function render(n: Notification, user: User): { subject: string; text: string } {
  const p = n.payload as Record<string, string>;
  const t = n.template as Template;
  const link = (path: string) => `${appUrl()}${path}`;
  const unsub = `${appUrl()}/unsubscribe?t=${encodeURIComponent(signToken(user.id, 60 * 86400, "unsub"))}`;
  const bodies: Record<Template, string> = {
    profile_completion: `Answering a few more questions in your SevaSutra profile may show more schemes you could be eligible for.\n\nSign in to continue: ${link("/profile")}`,
    missing_documents: `One of your application checklists still has documents to collect.\n\nSign in to see which ones: ${link(`/applications/${p.applicationId ?? ""}`)}`,
    deadline_upcoming: `A scheme you saved has a deadline coming up. Check the official portal in time.\n\nSign in to see details: ${link(`/schemes/${p.schemeId ?? ""}`)}`,
    deadline_changed: `The deadline for a scheme you saved was updated by our curators.\n\nSign in to see the new date: ${link(`/schemes/${p.schemeId ?? ""}`)}`,
    renewal_due: `An application you are tracking is due for renewal soon.\n\nSign in to see details: ${link(`/applications/${p.applicationId ?? ""}`)}`,
    application_status: `You updated the status of an application in your tracker.\n\nSign in to see it: ${link(`/applications/${p.applicationId ?? ""}`)}`,
    content_correction: `Our curators corrected the information for a scheme, and your earlier eligibility result is now different. Results are informational; the scheme authority decides.\n\nSign in to see the updated result: ${link(`/schemes/${p.schemeId ?? ""}`)}`,
    email_verify: `Confirm this email address for SevaSutra reminders (link valid for 24 hours):\n${p.verifyUrl ?? ""}\n\nIf you didn't request this, ignore this email.`,
  };
  const footer = t === "email_verify" ? "" : `\n\n—\nSevaSutra is an independent assistant, not a government website.\nUnsubscribe from all reminders: ${unsub}\nManage preferences: ${link("/account")}`;
  return { subject: SUBJECT[t], text: bodies[t] + footer };
}

/** Quiet hours 21:00–08:00 IST. Returns the next allowed send time, or null if now is fine. */
export function quietHoursDelay(now: Date): Date | null {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const h = ist.getUTCHours();
  if (h >= 8 && h < 21) return null;
  const next = new Date(ist);
  if (h >= 21) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(8, 0, 0, 0);
  return new Date(next.getTime() - 330 * 60_000);
}

export const MAX_ATTEMPTS = 5;
const backoff = (attempt: number) => Math.min(6 * 3600_000, 60_000 * 2 ** attempt);

export async function enqueue(db: PrismaClient, userId: string, template: Template, dedupeKey: string, payload: Record<string, unknown>) {
  return db.notification.upsert({ where: { dedupeKey }, update: {}, create: { userId, template, dedupeKey, payload: payload as never } });
}

export async function processDue(db: PrismaClient, now = new Date(), m: Mailer = getMailer(db)) {
  const due = await db.notification.findMany({ where: { status: { in: ["queued", "failed"] }, nextAttemptAt: { lte: now } }, include: { user: true }, take: 50 });
  const stats = { sent: 0, suppressed: 0, deferred: 0, failed: 0, dead: 0 };
  for (const n of due) {
    const t = n.template as Template;
    const prefs = (n.user.notificationPrefs as Record<string, boolean>) ?? {};
    const consent = t === "email_verify" || !!(await db.consent.findFirst({ where: { userId: n.userId, purpose: "reminders_email", granted: true, withdrawnAt: null } }));
    const pref = PREF_FOR[t];
    const allowed = !n.user.deletedAt && !!n.user.email && (t === "email_verify" || (!!n.user.emailVerifiedAt && consent && prefs.email === true && (!pref || prefs[pref] !== false)));
    if (!allowed) {
      await db.notification.update({ where: { id: n.id }, data: { status: "suppressed" } });
      stats.suppressed++;
      continue;
    }
    const quiet = t === "email_verify" ? null : quietHoursDelay(now);
    if (quiet) {
      await db.notification.update({ where: { id: n.id }, data: { nextAttemptAt: quiet } });
      stats.deferred++;
      continue;
    }
    const attempts = n.attempts + 1;
    try {
      const { subject, text } = render(n, n.user);
      const r = await m.send({ to: n.user.email!, subject, text });
      await db.notification.update({ where: { id: n.id }, data: { status: "sent", attempts, sentAt: now, providerMessageId: r.id, lastError: null } });
      await db.auditEvent.create({ data: { actorType: "system", action: "notification.sent", entityType: "notification", entityId: n.id, metadata: { template: t, channel: n.channel, attempts } } });
      stats.sent++;
    } catch (e) {
      const dead = attempts >= MAX_ATTEMPTS;
      await db.notification.update({ where: { id: n.id }, data: { status: dead ? "dead" : "failed", attempts, lastError: String(e).slice(0, 300), nextAttemptAt: new Date(now.getTime() + backoff(attempts)) } });
      await db.auditEvent.create({ data: { actorType: "system", action: dead ? "notification.dead" : "notification.failed", entityType: "notification", entityId: n.id, metadata: { template: t, attempts } } });
      if (dead) stats.dead++;
      else stats.failed++;
    }
  }
  return stats;
}
