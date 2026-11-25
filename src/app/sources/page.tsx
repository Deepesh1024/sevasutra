import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { Pill, fmtDate } from "@/components/ui";

export const metadata = { title: "Source register" };

export default async function SourcesPage() {
  const { lang } = await getT();
  const sources = await db.source.findMany({ orderBy: [{ isOfficial: "desc" }, { title: "asc" }] });
  return (
    <div className="max-w-5xl space-y-3">
      <h1 className="text-2xl font-bold">{lang === "hi" ? "स्रोत और लाइसेंस रजिस्टर" : "Source and licensing register"}</h1>
      <p className="text-ink-2">{lang === "hi" ? "सेवासूत्र में उपयोग किया गया हर स्रोत, उसकी शर्तें और अंतिम जाँच।" : "Every source SevaSutra relies on, its terms, and when it was last checked. SevaSutra is not affiliated with any of these."}</p>
      <div className="overflow-x-auto card">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-line"><th className="p-2">Source</th><th className="p-2">Publisher</th><th className="p-2">Kind / licence</th><th className="p-2">Terms & how we use it</th><th className="p-2">Last checked</th></tr></thead>
          <tbody>{sources.map((s) => (
            <tr key={s.id} className="border-b border-line align-top">
              <td className="p-2"><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a> {s.isOfficial ? <Pill tone="ok">official</Pill> : <Pill tone="warn">third-party</Pill>}</td>
              <td className="p-2">{s.publisher}</td>
              <td className="p-2">{s.kind} · {s.licence}</td>
              <td className="p-2">{s.termsNotes}</td>
              <td className="p-2">{s.lastFetchedAt ? `${fmtDate(s.lastFetchedAt, lang)} (HTTP ${s.lastHttpStatus ?? "—"})` : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
