import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { diffLines, pretty, withContext } from "@/lib/admin/diff";
import { Pill, fmtDate } from "@/components/ui";

export default async function SchemeVersions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  await requireStaff(["admin", "support"], "/admin/schemes");
  const { id } = await params;
  const sp = await searchParams;
  const versions = await db.schemeVersion.findMany({ where: { schemeId: id }, orderBy: { version: "desc" }, include: { rule: true } });
  if (!versions.length) notFound();
  const a = versions.find((v) => v.id === sp.a) ?? versions[1] ?? versions[0];
  const b = versions.find((v) => v.id === sp.b) ?? versions[0];
  const lines = withContext(diffLines(pretty(a.content), pretty(b.content)));
  const users = await db.user.findMany({ where: { id: { in: versions.flatMap((v) => [v.authorId, v.reviewerId]).filter(Boolean) as string[] } } });
  const who = (uid: string | null) => (uid ? users.find((u) => u.id === uid)?.displayName ?? uid.slice(0, 8) : "seed");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{versions[0].name} — version history</h1>
      <table className="w-full text-sm card">
        <thead><tr className="border-b border-line text-left"><th className="p-2">Version</th><th className="p-2">Status</th><th className="p-2">Rule hash</th><th className="p-2">Author / reviewer</th><th className="p-2">Change note</th><th className="p-2">Published</th></tr></thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id} className="border-b border-line align-top">
              <td className="p-2"><Link href={`/admin/versions/${v.id}`}>v{v.version}</Link></td>
              <td className="p-2"><Pill tone={v.status === "published" ? "ok" : v.status === "in_review" ? "review" : "muted"}>{v.status}</Pill></td>
              <td className="p-2"><code>{v.rule?.ruleHash}</code></td>
              <td className="p-2">{who(v.authorId)} / {who(v.reviewerId)}</td>
              <td className="p-2">{v.changeNote || <span className="text-bad">— none —</span>}</td>
              <td className="p-2">{fmtDate(v.publishedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div className="field"><label htmlFor="a">Compare</label><select id="a" name="a" defaultValue={a.id}>{versions.map((v) => <option key={v.id} value={v.id}>v{v.version} ({v.status})</option>)}</select></div>
        <div className="field"><label htmlFor="b">with</label><select id="b" name="b" defaultValue={b.id}>{versions.map((v) => <option key={v.id} value={v.id}>v{v.version} ({v.status})</option>)}</select></div>
        <button className="btn">Show diff</button>
      </form>
      <pre className="card p-3 text-xs overflow-x-auto" aria-label={`Diff v${a.version} to v${b.version}`}>
        {lines.length === 0 || lines.every((l) => l.kind === "gap") ? "No differences." : lines.map((l, i) => (
          <div key={i} className={l.kind === "add" ? "bg-ok-soft text-ok" : l.kind === "del" ? "bg-bad-soft text-bad" : l.kind === "gap" ? "text-ink-2 italic" : ""}>
            {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}{l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
