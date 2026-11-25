import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { STALE_DAYS } from "@/lib/schemes/repo";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const user = await requireStaff(["admin", "support"], "/admin");
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400_000);
  const [published, unverified, stale, drafts, inReview, openFeedback, brokenSources, chatTotal, chatFail, chatRefused, notifDead, notifFailed, injected, noNote, evals] = await Promise.all([
    db.schemeVersion.count({ where: { status: "published" } }),
    db.schemeVersion.count({ where: { status: "published", lastVerifiedAt: null } }),
    db.schemeVersion.count({ where: { status: "published", lastVerifiedAt: { lt: staleCutoff } } }),
    db.schemeVersion.count({ where: { status: "draft" } }),
    db.schemeVersion.count({ where: { status: "in_review" } }),
    db.feedback.count({ where: { status: { not: "resolved" } } }),
    db.source.count({ where: { lastHttpStatus: { gte: 400 } } }),
    db.chatMessage.count({ where: { role: "assistant" } }),
    db.chatMessage.count({ where: { role: "assistant", citationFailure: true } }),
    db.chatMessage.count({ where: { role: "assistant", refused: true } }),
    db.notification.count({ where: { status: "dead" } }),
    db.notification.count({ where: { status: "failed" } }),
    db.contentChunk.count({ where: { injectionFlag: true } }),
    db.schemeVersion.count({ where: { status: { in: ["published", "superseded"] }, version: { gt: 1 }, OR: [{ changeNote: null }, { changeNote: "" }] } }),
    db.evaluation.count(),
  ]);

  const tiles: [string, number, string, boolean][] = [
    ["Published schemes", published, "/admin/schemes", false],
    ["Never verified by a curator", unverified, "/admin/schemes", unverified > 0],
    [`Stale (> ${STALE_DAYS} days)`, stale, "/admin/schemes", stale > 0],
    ["Drafts", drafts, "/admin/schemes", false],
    ["Awaiting review", inReview, "/admin/schemes", inReview > 0],
    ["Open feedback", openFeedback, "/admin/feedback", openFeedback > 0],
    ["Broken source URLs", brokenSources, "/admin/sources", brokenSources > 0],
    ["Chat citation failures", chatFail, "/admin/audit", chatFail > 0],
    ["Chat refusals", chatRefused, "/admin/audit", false],
    ["Notifications failed / dead", notifFailed + notifDead, "/admin/notifications", notifDead > 0],
    ["Prompt-injection flagged chunks", injected, "/admin/schemes", injected > 0],
    ["Unexplained rule changes", noNote, "/admin/audit", noNote > 0],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin overview</h1>
      <p className="text-ink-2">Signed in as {user.role}. Support operators can draft corrections and answer feedback; only admins can publish.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, n, href, alert]) => (
          <li key={label}><Link href={href} className={`card p-4 block no-underline ${alert ? "bg-warn-soft" : ""}`}><span className="block text-3xl font-bold text-ink">{n}</span><span className="text-sm text-ink-2">{label}</span></Link></li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">{evals} stored evaluations · {chatTotal} chatbot answers · citation failure rate {chatTotal ? ((chatFail / chatTotal) * 100).toFixed(1) : "0"}%</p>
    </div>
  );
}
