import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reproduce } from "@/lib/eval/service";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; reproduce?: string }> }) {
  await requireStaff(["admin"], "/admin/audit");
  const sp = await searchParams;
  const rows = await db.auditEvent.findMany({
    where: { ...(sp.action ? { action: { contains: sp.action } } : {}), ...(sp.entity ? { entityId: sp.entity } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const repro = sp.reproduce ? await reproduce(sp.reproduce).catch(() => null) : null;
  const chatFailures = await db.chatMessage.findMany({ where: { citationFailure: true }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div className="field"><label htmlFor="ac">Action contains</label><input id="ac" name="action" defaultValue={sp.action ?? ""} placeholder="scheme.published" /></div>
        <div className="field"><label htmlFor="en">Entity id</label><input id="en" name="entity" defaultValue={sp.entity ?? ""} /></div>
        <button className="btn">Filter</button>
      </form>
      <form method="get" className="flex flex-wrap gap-2 items-end card p-3">
        <div className="field"><label htmlFor="rp">Reproduce an evaluation (id)</label><input id="rp" name="reproduce" defaultValue={sp.reproduce ?? ""} /></div>
        <button className="btn">Re-run against its historical rule version</button>
        {repro && <p className={repro.matches ? "text-ok" : "text-bad"}>Original: {repro.original} · reproduced: {repro.reproduced} · {repro.matches ? "✓ reproducible" : "✕ mismatch"}</p>}
        {sp.reproduce && !repro && <p className="text-bad">Evaluation not found.</p>}
      </form>
      {chatFailures.length > 0 && (
        <details className="card p-3"><summary className="cursor-pointer font-semibold">Recent chatbot citation failures ({chatFailures.length})</summary>
          <ul className="text-sm">{chatFailures.map((c) => <li key={c.id}>{c.createdAt.toISOString().slice(0, 16)} · {c.promptVersion}</li>)}</ul></details>
      )}
      <table className="w-full text-sm card">
        <thead><tr className="text-left border-b border-line"><th className="p-2">Time (UTC)</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">Details (redacted)</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-b border-line align-top"><td className="p-2 whitespace-nowrap">{r.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td><td className="p-2">{r.actorType}{r.actorId ? ` ${r.actorId.slice(0, 8)}` : ""}</td><td className="p-2">{r.action}</td><td className="p-2">{r.entityType} {r.entityId?.slice(0, 12)}</td><td className="p-2"><code className="text-xs break-all">{JSON.stringify(r.metadata)}</code></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
