import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";

export const metadata = { title: "Dev mailbox" };

// Development-only inbox for the DevMailer. Shows only mail addressed to the signed-in user's email
// (or everything for staff). Disabled in production.
export default async function DevMailbox() {
  if (process.env.NODE_ENV === "production") notFound();
  const user = await currentUser();
  const staff = user?.role === "admin" || user?.role === "support";
  const mails = await db.devMail.findMany({ where: staff ? {} : { to: user?.email ?? "__none__" }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div className="max-w-3xl space-y-3">
      <h1 className="text-2xl font-bold">Development mailbox</h1>
      <p className="text-ink-2 text-sm">No SMTP is configured, so emails are captured here instead of being sent.</p>
      {mails.length === 0 ? <p>No mail.</p> : mails.map((m) => (
        <article key={m.id} className="card p-3 space-y-1">
          <p className="text-sm text-ink-2">To {m.to} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
          <h2 className="font-semibold">{m.subject}</h2>
          <pre className="whitespace-pre-wrap text-sm">{m.text}</pre>
        </article>
      ))}
    </div>
  );
}
