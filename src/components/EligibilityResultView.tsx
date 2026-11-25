import type { EvaluationResult, LeafResult } from "@/lib/engine/types";
import { translate, type Lang } from "@/lib/i18n/dict";
import { rupees } from "@/lib/format";
import { factLabel } from "@/lib/profile/fields";
import { StatusBadge, pickL, fmtDate } from "./ui";

const PROV: Record<string, string> = { user_entered: "profile.provenance.user_entered", document_extracted: "profile.provenance.document_extracted", government_verified: "profile.provenance.government_verified", operator_verified: "profile.provenance.operator_verified" };

function LeafItem({ l, lang }: { l: LeafResult; lang: Lang }) {
  return (
    <li className="py-1.5">
      <p>{pickL(l.explanation, lang)}</p>
      {l.provenance && l.provenance !== "mixed" && <p className="help">{translate(lang, PROV[l.provenance] as never)}</p>}
    </li>
  );
}

export function EligibilityResultView({
  result, lang, meta,
}: {
  result: EvaluationResult;
  lang: Lang;
  meta?: { versionLabel?: string; sourceTitle?: string; sourceUrl?: string; lastVerified?: Date | null; effectiveFrom?: string; checkedAt?: Date; evaluationId?: string };
}) {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k as never, v);
  const decisive = result.leaves.filter((l) => l.decisive);
  const passed = decisive.filter((l) => l.outcome === "pass");
  const failed = decisive.filter((l) => l.outcome === "fail");
  const missing = decisive.filter((l) => ["unknown", "declined", "unverified", "conflict"].includes(l.outcome));
  const missingDocs = result.documents.filter((d) => d.required && !d.present);
  const b = result.benefit;

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={result.status} lang={lang} />
        <p className="font-semibold">{pickL(result.headline, lang)}</p>
      </div>
      {result.closedReason && <p className="text-muted">{pickL(result.closedReason, lang)}</p>}
      {result.manualReviewReason && <p className="text-review">{pickL(result.manualReviewReason, lang)}</p>}
      {result.exceptionApplied && <p className="text-review">{pickL(result.exceptionApplied.explanation, lang)}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <section className="card p-3" aria-labelledby="passed-h">
          <h4 id="passed-h" className="font-bold text-ok">✓ {t("elig.passed")} ({passed.length})</h4>
          <ul className="text-sm divide-y divide-line">{passed.map((l) => <LeafItem key={l.id} l={l} lang={lang} />)}</ul>
        </section>
        <section className="card p-3" aria-labelledby="failed-h">
          <h4 id="failed-h" className="font-bold text-bad">✕ {t("elig.failed")} ({failed.length})</h4>
          <ul className="text-sm divide-y divide-line">{failed.map((l) => <LeafItem key={l.id} l={l} lang={lang} />)}</ul>
        </section>
        <section className="card p-3" aria-labelledby="missing-h">
          <h4 id="missing-h" className="font-bold text-warn">◐ {t("elig.missing")} ({missing.length + missingDocs.length})</h4>
          <ul className="text-sm divide-y divide-line">
            {missing.map((l) => <LeafItem key={l.id} l={l} lang={lang} />)}
            {missingDocs.map((d) => (
              <li key={d.type} className="py-1.5">
                {lang === "hi" ? "दस्तावेज़ तैयार रखें: " : "Document to keep ready: "}{pickL(d.label, lang)}
                {d.alternatives.length > 0 && <span className="help block">{lang === "hi" ? "स्वीकार्य विकल्प: " : "Acceptable alternatives: "}{d.alternatives.map((a) => pickL(a.label, lang)).join(", ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {result.whatWouldChange.length > 0 && (
        <section className="card p-3" aria-labelledby="change-h">
          <h4 id="change-h" className="font-bold">{t("elig.change")}</h4>
          <ul className="list-disc pl-5 text-sm space-y-1 mt-1">{result.whatWouldChange.map((w, i) => <li key={i}>{pickL(w, lang)}</li>)}</ul>
        </section>
      )}

      {b && (
        <section className="card p-3" aria-labelledby="benefit-h">
          <h4 id="benefit-h" className="font-bold">{t("elig.estimate")}</h4>
          <p className="text-lg font-semibold mt-1">
            {b.amount !== undefined ? rupees(b.amount) : b.amountMax !== undefined ? `${b.amountMin && b.amountMin !== b.amountMax ? `${rupees(b.amountMin)}–` : lang === "hi" ? "अधिकतम " : "up to "}${rupees(b.amountMax)}` : lang === "hi" ? "कोई मौद्रिक अनुमान नहीं" : "No monetary estimate"}
            {b.annualised !== undefined && <span className="text-ink-2 font-normal text-base"> · {rupees(b.annualised)} {t("dash.perYear")}</span>}
          </p>
          {!b.stated && b.countsAsMoney && <p className="text-warn text-sm font-semibold">{lang === "hi" ? "यह एक अनुमान/सीमा है — मिलने वाली निश्चित राशि नहीं।" : "This is an estimate or ceiling — not an amount you will definitely receive."}</p>}
          <ul className="list-disc pl-5 text-sm mt-1 space-y-0.5">{b.calculation.map((c, i) => <li key={i}>{pickL(c, lang)}</li>)}</ul>
        </section>
      )}

      {result.caveats.length > 0 && (
        <section className="text-sm" aria-labelledby="caveat-h">
          <h4 id="caveat-h" className="font-bold">{t("scheme.caveats")}</h4>
          <ul className="list-disc pl-5">{result.caveats.map((c, i) => <li key={i}>{pickL(c, lang)}</li>)}</ul>
        </section>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">{t("elig.inputs")}</summary>
        <table className="mt-2 text-left w-full">
          <thead><tr className="border-b border-line"><th className="py-1 pr-2">Fact</th><th className="py-1 pr-2">Condition</th><th className="py-1">Outcome</th></tr></thead>
          <tbody>
            {result.leaves.filter((l) => l.kind === "fact").map((l) => (
              <tr key={l.id} className="border-b border-line align-top">
                <td className="py-1 pr-2">{l.fact ? pickL(factLabel(l.fact), lang) : ""}</td>
                <td className="py-1 pr-2"><code className="text-xs">{l.op} {l.expected !== undefined ? JSON.stringify(l.expected) : ""}</code></td>
                <td className="py-1">{l.outcome}{l.decisive ? "" : " (not used)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-ink-2">
          {t("elig.ruleVersion")}: {meta?.versionLabel ?? "—"} · rule {result.ruleHash} · engine {result.engineVersion} · reference date {result.referenceDate}
          {meta?.effectiveFrom && <> · {t("scheme.effective")} {fmtDate(meta.effectiveFrom, lang)}</>}
          {" · "}{t("scheme.lastVerified")}: {meta?.lastVerified ? fmtDate(meta.lastVerified, lang) : t("scheme.never")}
          {meta?.checkedAt && <> · {t("elig.checkedOn")} {fmtDate(meta.checkedAt, lang)}</>}
          {meta?.evaluationId && <> · evaluation <code>{meta.evaluationId}</code></>}
        </p>
        {meta?.sourceUrl && <p className="text-ink-2">Source: <a href={meta.sourceUrl} target="_blank" rel="noopener noreferrer">{meta.sourceTitle}</a></p>}
      </details>

      <p className="text-sm text-ink-2 border-l-4 border-warn pl-3">{pickL(result.disclaimer, lang)}</p>
    </div>
  );
}
