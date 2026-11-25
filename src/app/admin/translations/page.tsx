import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Pill } from "@/components/ui";
import { saveTranslationAction } from "@/app/actions/admin";
import { Flash } from "../Flash";
import type { SchemeContent } from "@/lib/schemes/types";

export const metadata = { title: "Translations" };

export default async function TranslationsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireStaff(["admin", "support"], "/admin/translations");
  const sp = await searchParams;
  const terms = await db.translation.findMany({ orderBy: { term: "asc" } });
  const published = await db.schemeVersion.findMany({ where: { status: "published" } });
  const gaps = published.map((v) => {
    const c = v.content as unknown as SchemeContent;
    const missing = [!c.name.hi && "name", !c.summary.hi && "summary", !c.benefit.basis.hi && "benefit basis", c.application.steps.some((s) => !s.hi) && "steps", c.documents.some((d) => !d.label.hi) && "documents"].filter(Boolean);
    return { v, missing };
  }).filter((x) => x.missing.length);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Translations (Hindi)</h1>
      <Flash sp={sp} />
      <p className="text-sm text-ink-2">Terminology must be validated before translated explanations or speech are enabled. Machine translation is not used for legal text; the original source text is always shown alongside.</p>
      <section className="card p-4 space-y-2">
        <h2 className="font-bold text-lg">Glossary</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-line"><th className="p-1">English term</th><th className="p-1">Hindi</th><th className="p-1">Status</th></tr></thead>
          <tbody>{terms.map((t) => <tr key={t.id} className="border-b border-line"><td className="p-1">{t.term}</td><td className="p-1" lang="hi">{t.text}</td><td className="p-1"><Pill tone={t.status === "approved" ? "ok" : "warn"}>{t.status}</Pill></td></tr>)}</tbody>
        </table>
        <form action={saveTranslationAction} className="flex flex-wrap gap-2 items-end">
          <div className="field"><label htmlFor="term">English term</label><input id="term" name="term" required /></div>
          <div className="field"><label htmlFor="text">Hindi</label><input id="text" name="text" lang="hi" required /></div>
          {user.role === "admin" && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="approve" /> approve</label>}
          <button className="btn btn-sm">Save</button>
        </form>
      </section>
      <section className="card p-4">
        <h2 className="font-bold text-lg">Schemes with missing Hindi text</h2>
        {gaps.length === 0 ? <p>None.</p> : <ul className="text-sm">{gaps.map(({ v, missing }) => <li key={v.id}><Link href={`/admin/schemes/${v.schemeId}`}>{v.name}</Link>: {missing.join(", ")}</li>)}</ul>}
      </section>
    </div>
  );
}
