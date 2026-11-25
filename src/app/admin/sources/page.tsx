import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Pill, fmtDate } from "@/components/ui";
import { checkSourceAction, setSourceStatusAction } from "@/app/actions/admin";
import { Flash } from "../Flash";

export const metadata = { title: "Sources" };

export default async function SourcesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireStaff(["admin", "support"], "/admin/sources");
  const sp = await searchParams;
  const sources = await db.source.findMany({ orderBy: { id: "asc" }, include: { snapshots: { orderBy: { fetchedAt: "desc" }, take: 1 } } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Source register & freshness</h1>
      <Flash sp={sp} />
      <p className="text-sm text-ink-2">Checks fetch the URL once (low rate, identified user agent), record HTTP status and a content hash, and flag changes for review. Scraping of content is not performed.</p>
      <div className="overflow-x-auto card">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-line"><th className="p-2">Source</th><th className="p-2">Type / licence</th><th className="p-2">Last check</th><th className="p-2">Review</th><th className="p-2"></th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-line align-top">
                <td className="p-2"><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold">{s.title}</a><br /><span className="text-ink-2">{s.publisher}</span> {s.isOfficial ? <Pill tone="ok">official</Pill> : <Pill tone="warn">third-party</Pill>}</td>
                <td className="p-2">{s.kind} · {s.licence}<details><summary className="cursor-pointer">terms</summary>{s.termsNotes}</details></td>
                <td className="p-2">{s.lastFetchedAt ? <>{fmtDate(s.lastFetchedAt)} · <Pill tone={s.lastHttpStatus && s.lastHttpStatus < 400 ? "ok" : "bad"}>HTTP {s.lastHttpStatus ?? "error"}</Pill>{s.snapshots[0]?.notes && <p className="text-warn">{s.snapshots[0].notes}</p>}</> : "never"}</td>
                <td className="p-2">
                  {user.role === "admin" ? (
                    <form action={setSourceStatusAction} className="flex gap-1"><input type="hidden" name="id" value={s.id} /><select name="status" defaultValue={s.reviewerStatus} className="input"><option>pending</option><option>approved</option><option>blocked</option></select><button className="btn btn-sm">Set</button></form>
                  ) : s.reviewerStatus}
                </td>
                <td className="p-2"><form action={checkSourceAction}><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm">Check URL</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
