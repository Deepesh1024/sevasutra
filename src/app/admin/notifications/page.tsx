import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Pill, fmtDate } from "@/components/ui";
import { runNotificationsAction } from "@/app/actions/admin";
import { Flash } from "../Flash";

export const metadata = { title: "Notifications" };

export default async function NotificationsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireStaff(["admin", "support"], "/admin/notifications");
  const sp = await searchParams;
  const rows = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const counts = await db.notification.groupBy({ by: ["status"], _count: true });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notification queue</h1>
      <Flash sp={sp} />
      <p className="text-sm">{counts.map((c) => `${c.status}: ${c._count}`).join(" · ") || "Empty"} {process.env.NODE_ENV !== "production" && !process.env.SMTP_URL && <>· <Link href="/dev/mailbox">dev mailbox</Link></>}</p>
      {user.role === "admin" && <form action={runNotificationsAction}><button className="btn">Run scheduler + one delivery pass now</button></form>}
      <p className="text-sm text-ink-2">In production run <code>npm run reminders</code> daily and <code>npm run worker</code> continuously. Failed sends retry with exponential backoff; after 5 attempts they move to <em>dead</em>.</p>
      <table className="w-full text-sm card">
        <thead><tr className="text-left border-b border-line"><th className="p-2">Created</th><th className="p-2">Template</th><th className="p-2">Status</th><th className="p-2">Attempts</th><th className="p-2">Next attempt / sent</th><th className="p-2">Error</th></tr></thead>
        <tbody>{rows.map((n) => (
          <tr key={n.id} className="border-b border-line"><td className="p-2">{fmtDate(n.createdAt)}</td><td className="p-2">{n.template}</td><td className="p-2"><Pill tone={n.status === "sent" ? "ok" : n.status === "dead" ? "bad" : n.status === "suppressed" ? "muted" : "warn"}>{n.status}</Pill></td><td className="p-2">{n.attempts}</td><td className="p-2">{n.sentAt ? fmtDate(n.sentAt) : n.nextAttemptAt.toISOString().slice(0, 16)}</td><td className="p-2 text-bad">{n.lastError}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
