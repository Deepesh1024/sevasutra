import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Pill, fmtDate } from "@/components/ui";
import { respondFeedbackAction } from "@/app/actions/admin";
import { Flash } from "../Flash";

export const metadata = { title: "Feedback" };

export default async function FeedbackAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; all?: string }> }) {
  await requireStaff(["admin", "support"], "/admin/feedback");
  const sp = await searchParams;
  const items = await db.feedback.findMany({ where: sp.all ? {} : { status: { not: "resolved" } }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline"><h1 className="text-2xl font-bold">User-reported issues & questions</h1><Link href={sp.all ? "/admin/feedback" : "/admin/feedback?all=1"} className="btn btn-sm">{sp.all ? "Open only" : "Show resolved too"}</Link></div>
      <Flash sp={sp} />
      <p className="text-sm text-ink-2">To correct content, open the scheme and create a new draft version. Published eligibility results are never edited in place.</p>
      {items.length === 0 ? <p>Nothing open.</p> : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className="card p-3 space-y-2">
              <p className="text-sm"><Pill tone={f.status === "resolved" ? "ok" : "warn"}>{f.status}</Pill> <Pill>{f.kind}</Pill> {f.schemeId && <Link href={`/admin/schemes/${f.schemeId}`}>{f.schemeId}</Link>} · {fmtDate(f.createdAt)} · {f.userId ? "signed-in user" : "guest"}</p>
              <p className="whitespace-pre-line">{f.message}</p>
              <form action={respondFeedbackAction} className="flex flex-wrap gap-2 items-end">
                <input type="hidden" name="id" value={f.id} />
                <div className="field flex-1 min-w-[16rem]"><label htmlFor={`r-${f.id}`}>Internal response / action taken</label><input id={`r-${f.id}`} name="response" defaultValue={f.response ?? ""} /></div>
                <select name="status" defaultValue={f.status} className="input max-w-[10rem]" aria-label="Status"><option>open</option><option>triaged</option><option>resolved</option></select>
                <button className="btn btn-sm">Update</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
