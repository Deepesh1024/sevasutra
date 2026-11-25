import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { freshness } from "@/lib/schemes/repo";
import { Pill, fmtDate } from "@/components/ui";
import { newDraftAction } from "@/app/actions/admin";
import { Flash } from "../Flash";

export default async function AdminSchemes({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaff(["admin", "support"], "/admin/schemes");
  const sp = await searchParams;
  const schemes = await db.scheme.findMany({ include: { versions: { orderBy: { version: "desc" } } }, orderBy: { id: "asc" } });
  const flagged = await db.contentChunk.findMany({ where: { injectionFlag: true }, include: { schemeVersion: true } });
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline"><h1 className="text-2xl font-bold">Schemes</h1><Link href="/admin/import" className="btn btn-sm">+ Import scheme</Link></div>
      <Flash sp={sp} />
      {flagged.length > 0 && (
        <div className="card p-3 bg-bad-soft"><p className="font-semibold text-bad">Prompt-injection patterns detected in content (excluded from chatbot retrieval):</p>
          <ul className="text-sm">{flagged.map((f) => <li key={f.id}>{f.schemeVersion.schemeId} v{f.schemeVersion.version} — {f.section}</li>)}</ul></div>
      )}
      <div className="overflow-x-auto card">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-line"><th className="p-2">Scheme</th><th className="p-2">Published</th><th className="p-2">Verified</th><th className="p-2">Other versions</th><th className="p-2"></th></tr></thead>
          <tbody>
            {schemes.map((s) => {
              const pub = s.versions.find((v) => v.status === "published");
              const fr = pub ? freshness(pub) : "unverified";
              const open = s.versions.find((v) => v.status === "draft" || v.status === "in_review");
              return (
                <tr key={s.id} className="border-b border-line align-top">
                  <td className="p-2"><Link href={`/admin/schemes/${s.id}`} className="font-semibold">{pub?.name ?? s.id}</Link><br /><code className="text-xs">{s.id}</code> {s.highImpact && <Pill tone="review">high impact</Pill>}</td>
                  <td className="p-2">{pub ? `v${pub.version} · ${fmtDate(pub.publishedAt)}` : "—"}</td>
                  <td className="p-2"><Pill tone={fr === "fresh" ? "ok" : "warn"}>{fr}</Pill> {pub?.lastVerifiedAt ? fmtDate(pub.lastVerifiedAt) : ""}</td>
                  <td className="p-2">{s.versions.filter((v) => v.status !== "published").map((v) => <Link key={v.id} href={`/admin/versions/${v.id}`} className="block">v{v.version} {v.status}</Link>)}</td>
                  <td className="p-2">
                    {open ? <Link className="btn btn-sm" href={`/admin/versions/${open.id}`}>Open {open.status.replace("_", " ")}</Link> : (
                      <form action={newDraftAction}><input type="hidden" name="schemeId" value={s.id} /><button className="btn btn-sm">New draft version</button></form>
                    )}
                    {pub && <Link className="btn btn-sm mt-1" href={`/admin/versions/${pub.id}`}>View published</Link>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
