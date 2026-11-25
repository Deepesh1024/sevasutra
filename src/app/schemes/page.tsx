import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { facetValues, listPublished, contentOf, evaluable, type SchemeFilters } from "@/lib/schemes/repo";
import { SchemeCard } from "@/components/SchemeCard";
import { BENEFIT_LABEL, CATEGORY_LABEL, LEVEL_LABEL, MODE_LABEL, SCHOLARSHIP_LABEL, TARGET_LABEL, pickL } from "@/components/ui";
import { STATES } from "@/lib/profile/fields";
import { currentUser } from "@/lib/auth/session";
import { ensurePrimaryProfile, factInputFor } from "@/lib/profile/service";
import { evaluate } from "@/lib/engine/evaluate";
import { vaultDocTypes } from "@/lib/eval/service";
import type { EligibilityStatus } from "@/lib/engine/types";

export const metadata = { title: "Schemes" };

type SP = Record<string, string | undefined>;

export default async function SchemesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const filters: SchemeFilters = {
    q: sp.q, ministry: sp.ministry, level: sp.level, state: sp.state, category: sp.category, kind: sp.kind,
    benefitType: sp.benefit, mode: sp.mode, scholarshipType: sp.stype, deadline: (sp.deadline as SchemeFilters["deadline"]) ?? "any", target: sp.target,
  };
  const [rows, facets, user] = await Promise.all([listPublished(filters), facetValues(), currentUser()]);

  // Signed-in users see a status chip per scheme (computed live, not stored).
  const statuses: Record<string, EligibilityStatus> = {};
  if (user) {
    const p = await ensurePrimaryProfile(user.id);
    const input = await factInputFor(p.id);
    const docs = await vaultDocTypes(user.id, p.id);
    if (Object.keys(input).length > 0) for (const r of rows) statuses[r.schemeId] = evaluate(evaluable(r), input, { documents: docs }).status;
  }

  const group = sp.group === "ministry" ? "ministry" : sp.group === "jurisdiction" ? "jurisdiction" : null;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const c = contentOf(r);
    const key = group === "ministry" ? r.ministry : group === "jurisdiction" ? (c.stateScope.length ? `${pickL(LEVEL_LABEL[c.level], lang)} — ${c.stateScope.map((s) => pickL(STATES.find((x) => x.value === s)?.label, lang)).join(", ")}` : pickL(LEVEL_LABEL[c.level], lang)) : "";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const sel = (name: string, label: string, opts: [string, string][], value?: string) => (
    <div className="field">
      <label htmlFor={`flt-${name}`}>{label}</label>
      <select id={`flt-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{t("filters.any")}</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside aria-labelledby="flt-h">
        <form method="get" className="card p-4 space-y-3 lg:sticky lg:top-4">
          <h2 id="flt-h" className="font-bold">{t("filters.title")}</h2>
          <div className="field">
            <label htmlFor="flt-q">{t("search.button")}</label>
            <input id="flt-q" name="q" defaultValue={sp.q ?? ""} placeholder={t("search.placeholder")} />
          </div>
          {sel("kind", t("filters.kind"), [["scheme", lang === "hi" ? "योजना" : "Scheme"], ["scholarship", lang === "hi" ? "छात्रवृत्ति" : "Scholarship"]], sp.kind)}
          {sel("stype", t("filters.scholarshipType"), facets.scholarshipTypes.map((s) => [s, pickL(SCHOLARSHIP_LABEL[s], lang)]), sp.stype)}
          {sel("ministry", t("filters.ministry"), facets.ministries.map((m) => [m, m]), sp.ministry)}
          {sel("level", t("filters.level"), facets.levels.map((l) => [l, pickL(LEVEL_LABEL[l], lang)]), sp.level)}
          {sel("state", t("filters.state"), STATES.map((s) => [s.value, pickL(s.label, lang)]), sp.state)}
          {sel("category", t("filters.category"), facets.categories.map((c) => [c, pickL(CATEGORY_LABEL[c] ?? { en: c }, lang)]), sp.category)}
          {sel("target", t("filters.beneficiary"), facets.targets.map((x) => [x, pickL(TARGET_LABEL(x), lang)]), sp.target)}
          {sel("benefit", t("filters.benefit"), facets.benefitTypes.map((b) => [b, pickL(BENEFIT_LABEL[b], lang)]), sp.benefit)}
          {sel("mode", t("filters.mode"), facets.modes.map((m) => [m, pickL(MODE_LABEL[m], lang)]), sp.mode)}
          {sel("deadline", t("filters.deadline"), [["30d", lang === "hi" ? "30 दिनों में बंद" : "Closing within 30 days"], ["open", lang === "hi" ? "केवल खुली" : "Open only"]], sp.deadline)}
          {sel("group", lang === "hi" ? "समूह बनाएँ" : "Group by", [["ministry", lang === "hi" ? "मंत्रालय" : "Ministry"], ["jurisdiction", lang === "hi" ? "क्षेत्राधिकार" : "Jurisdiction"]], sp.group)}
          <div className="flex gap-2">
            <button className="btn btn-primary">{t("filters.apply")}</button>
            <Link href="/schemes" className="btn">{t("filters.clear")}</Link>
          </div>
        </form>
      </aside>

      <section aria-labelledby="res-h" className="space-y-4">
        <div className="flex flex-wrap justify-between items-baseline gap-2">
          <h1 id="res-h" className="text-2xl font-bold">{t("nav.schemes")}</h1>
          <p className="text-ink-2" role="status">{t("results.count", { n: rows.length })}</p>
        </div>
        {!user && <p className="text-sm text-ink-2">{lang === "hi" ? "अपनी पात्रता देखने के लिए किसी योजना को खोलें, या " : "Open a scheme to check eligibility, or "}<Link href="/login">{lang === "hi" ? "साइन इन करें" : "sign in"}</Link>{lang === "hi" ? " और सभी योजनाओं की स्थिति देखें।" : " to see your status on every scheme."}</p>}
        {rows.length === 0 && <p>{t("results.none")}</p>}
        {[...groups.entries()].map(([g, items]) => (
          <div key={g || "all"} className="space-y-3">
            {g && <h2 className="text-lg font-bold border-b border-line pb-1">{g} <span className="text-ink-2 font-normal">({items.length})</span></h2>}
            <ul className="grid gap-4 md:grid-cols-2">
              {items.map((r) => (
                <li key={r.id}>
                  <SchemeCard v={r} lang={lang} status={statuses[r.schemeId]} extra={
                    <label className="text-sm inline-flex items-center gap-2"><input type="checkbox" form="compare-form" name="ids" value={r.schemeId} className="w-4 h-4" />{t("scheme.compare")}</label>
                  } />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <form id="compare-form" action="/compare" method="get" className="sticky bottom-3">
          <button className="btn btn-primary shadow">{lang === "hi" ? "चुनी गई योजनाओं की तुलना करें" : "Compare selected schemes"}</button>
        </form>
      </section>
    </div>
  );
}
