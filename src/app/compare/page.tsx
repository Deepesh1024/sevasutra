import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { contentOf, getPublished, freshness } from "@/lib/schemes/repo";
import { BENEFIT_LABEL, LEVEL_LABEL, MODE_LABEL, fmtDate, pickL } from "@/components/ui";
import { rupees } from "@/lib/format";

export const metadata = { title: "Compare schemes" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const sp = await searchParams;
  const ids = (Array.isArray(sp.ids) ? sp.ids : (sp.ids ?? "").split(",")).filter(Boolean).slice(0, 4);
  const { lang, L } = await getT();
  const hi = lang === "hi";
  const versions = (await Promise.all(ids.map((id) => getPublished(id)))).filter((v): v is NonNullable<typeof v> => !!v);
  if (versions.length === 0) return <p>{hi ? "तुलना के लिए योजना सूची से 2–4 योजनाएँ चुनें।" : "Pick 2–4 schemes from the scheme list to compare."} <Link href="/schemes">{hi ? "योजनाएँ" : "Schemes"}</Link></p>;
  const cs = versions.map((v) => ({ v, c: contentOf(v) }));
  const rows: [string, (x: (typeof cs)[number]) => React.ReactNode][] = [
    [hi ? "मंत्रालय" : "Ministry", ({ c }) => c.ministry],
    [hi ? "स्तर" : "Level", ({ c }) => `${pickL(LEVEL_LABEL[c.level], lang)}${c.stateScope.length ? ` (${c.stateScope.join(", ")})` : ""}`],
    [hi ? "लाभ" : "Benefit", ({ c }) => <>{pickL(BENEFIT_LABEL[c.benefit.kind], lang)}{c.benefit.amountMax !== undefined && <> · {c.benefit.stated ? "" : hi ? "अधिकतम " : "up to "}{rupees(c.benefit.amountMax)}</>}<p className="help">{L(c.benefit.basis)}</p></>],
    [hi ? "मुख्य शर्तें" : "Key conditions", ({ c }) => {
      const labels: string[] = [];
      const walk = (n: typeof c.rule.mandatory, neg = false): void => {
        if ("fact" in n || "doc" in n) labels.push(`${neg ? (hi ? "नहीं: " : "Not: ") : ""}${L(n.label)}`);
        else if ("all" in n) n.all.forEach((x) => walk(x, neg));
        else if ("any" in n) labels.push(`${hi ? "इनमें से एक" : "One of"}: ${n.any.map((x) => ("label" in x && x.label ? L(x.label) : "…")).join(" / ")}`);
        else walk(n.not, !neg);
      };
      walk(c.rule.mandatory);
      return <ul className="list-disc pl-4">{labels.map((l, i) => <li key={i}>{l}</li>)}</ul>;
    }],
    [hi ? "आवश्यक दस्तावेज़" : "Required documents", ({ c }) => c.documents.filter((d) => d.required).map((d) => L(d.label)).join(", ")],
    [hi ? "आवेदन" : "How to apply", ({ c }) => pickL(MODE_LABEL[c.application.mode], lang)],
    [hi ? "अंतिम तिथि" : "Deadline", ({ c }) => (c.application.deadline ? fmtDate(c.application.deadline, lang) : "—")],
    [hi ? "स्रोत की ताज़गी" : "Source freshness", ({ v }) => `${freshness(v)} · v${v.version}`],
  ];
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{hi ? "योजनाओं की तुलना" : "Compare schemes"}</h1>
      <div className="overflow-x-auto card">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-line"><th className="p-2 w-40"><span className="sr-only">Field</span></th>{cs.map(({ v, c }) => <th key={v.id} className="p-2 align-top"><Link href={`/schemes/${v.schemeId}`}>{L(c.name)}</Link>{c.isThirdParty && <span className="block text-warn text-xs">{hi ? "गैर-सरकारी" : "Non-government"}</span>}</th>)}</tr></thead>
          <tbody>{rows.map(([label, fn]) => <tr key={label} className="border-b border-line align-top"><th scope="row" className="p-2">{label}</th>{cs.map((x) => <td key={x.v.id} className="p-2">{fn(x)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
