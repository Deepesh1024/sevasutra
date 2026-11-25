import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getProfiles, factInputFor } from "@/lib/profile/service";
import { evaluateAndRecord, vaultDocTypes } from "@/lib/eval/service";
import { listPublished, contentOf } from "@/lib/schemes/repo";
import { summariseBenefits, type SummaryItem } from "@/lib/eval/summary";
import { FIELDS, factLabel } from "@/lib/profile/fields";
import { resolveFact } from "@/lib/engine/facts";
import { APP_STATE_LABEL, APPLIED_STATES, checklistProgress, type AppState, type Checklist } from "@/lib/applications";
import { StatusBadge, Pill, fmtDate, pickL } from "@/components/ui";
import { rupees } from "@/lib/format";
import type { EligibilityStatus, EvaluationResult } from "@/lib/engine/types";
import type { Lang } from "@/lib/i18n/dict";
import { isApplicant } from "@/lib/auth/roles";

export const metadata = { title: "My dashboard" };

type Row = { schemeId: string; name: string; status: EligibilityStatus; result: EvaluationResult; deadline: Date | null; content: ReturnType<typeof contentOf> };

function Section({ id, title, rows, lang, empty, children }: { id: string; title: string; rows?: Row[]; lang: Lang; empty: string; children?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-4 space-y-2">
      <h2 id={id} className="font-bold text-lg">{title} {rows && <span className="text-ink-2 font-normal">({rows.length})</span>}</h2>
      {children}
      {rows && (rows.length === 0 ? <p className="text-ink-2 text-sm">{empty}</p> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.schemeId} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <Link href={`/schemes/${r.schemeId}`} className="font-semibold">{r.name}</Link>
              <span className="flex items-center gap-2 text-sm">
                {r.deadline && <span className="text-ink-2">{fmtDate(r.deadline, lang)}</span>}
                <StatusBadge status={r.status} lang={lang} />
              </span>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}

export default async function Dashboard() {
  const { t, lang, L } = await getT();
  const user = await currentUser();
  const hi = lang === "hi";
  if (!user) {
    return (
      <div className="card p-6 max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <p>{hi ? "अपना डैशबोर्ड देखने के लिए साइन इन करें — या बिना खाते के त्वरित जाँच करें।" : "Sign in to see your dashboard — or run a quick check without an account."}</p>
        <div className="flex gap-2"><Link href="/login?next=/dashboard" className="btn btn-primary">{t("nav.login")}</Link><Link href="/check" className="btn">{hi ? "त्वरित जाँच" : "Quick check (no account)"}</Link></div>
      </div>
    );
  }

  const profiles = await getProfiles(user.id);
  const primary = profiles[0];
  const schemes = await listPublished();
  const input = await factInputFor(primary.id);
  const discoveryMissing = FIELDS.filter((f) => f.discovery && f.key !== "age_band" && resolveFact(input[f.key], new Date()).state !== "known" && !(f.key === "date_of_birth" && input["age_band"]));

  const rows: Row[] = [];
  for (const v of schemes) {
    const { result } = await evaluateAndRecord(user.id, primary.id, v);
    rows.push({ schemeId: v.schemeId, name: L(contentOf(v).name), status: result.status, result, deadline: v.deadline, content: contentOf(v) });
  }
  const by = (s: EligibilityStatus) => rows.filter((r) => r.status === s);
  const soon = rows.filter((r) => r.deadline && r.deadline.getTime() - Date.now() < 30 * 86400_000 && r.deadline.getTime() > Date.now() && r.status !== "not_eligible");

  const saved = await db.savedScheme.findMany({ where: { userId: user.id } });
  const savedRows = rows.filter((r) => saved.some((s) => s.schemeId === r.schemeId));
  const apps = await db.application.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  const vault = await vaultDocTypes(user.id);

  // Which missing facts would unlock the most partially-eligible schemes?
  const missingCount = new Map<string, number>();
  for (const r of by("partially_eligible")) for (const l of r.result.leaves) if (l.decisive && (l.outcome === "unknown" || l.outcome === "declined") && l.fact) missingCount.set(l.fact, (missingCount.get(l.fact) ?? 0) + 1);
  const topMissing = [...missingCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Renewal: approved/submitted applications whose scheme renews yearly and that are ≥ 10 months old, or explicit renewal date soon.
  const renewals = apps.filter((a) => {
    const r = rows.find((x) => x.schemeId === a.schemeId);
    const months = r?.content.application.renewalMonths;
    if (a.renewalDueAt) return a.renewalDueAt.getTime() - Date.now() < 60 * 86400_000;
    return !!months && APPLIED_STATES.includes(a.state as AppState) && Date.now() - a.updatedAt.getTime() > (months - 2) * 30 * 86400_000;
  });

  // Household view: evaluate each member live (results also recorded).
  const household: { label: string; isPrimary: boolean; items: SummaryItem[] }[] = [];
  for (const p of profiles) {
    const items: SummaryItem[] = [];
    for (const v of schemes) {
      const res = p.id === primary.id ? rows.find((r) => r.schemeId === v.schemeId)!.result : (await evaluateAndRecord(user.id, p.id, v)).result;
      items.push({ schemeId: v.schemeId, name: contentOf(v).name, result: res, unit: contentOf(v).beneficiaryUnit ?? "individual", memberLabel: p.label, thirdParty: contentOf(v).isThirdParty });
    }
    household.push({ label: p.label, isPrimary: p.isPrimary, items });
  }
  const mine = summariseBenefits(household[0].items);
  const hh = summariseBenefits(household.flatMap((h) => h.items));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <p className="text-sm text-ink-2">{hi ? "प्रोफ़ाइल" : "Profile"}: <strong>{primary.label}</strong> · {isApplicant(user) ? <Pill tone="ok">{hi ? "सत्यापित आवेदक" : "Verified applicant"}</Pill> : <Pill tone="warn">{hi ? "एक्सप्लोरर" : "Explorer"}</Pill>}</p>
      </div>

      {(discoveryMissing.length > 0 || topMissing.length > 0) && (
        <section aria-labelledby="cp-h" className="card p-4 bg-primary-soft space-y-2">
          <h2 id="cp-h" className="font-bold text-lg">{t("dash.complete")}</h2>
          {discoveryMissing.length > 0 && <p>{hi ? "बुनियादी प्रश्न बाकी हैं" : "Basic questions left"}: {discoveryMissing.map((f) => pickL(f.label, lang)).join(" · ")}</p>}
          {topMissing.length > 0 && (
            <p className="text-sm">{hi ? "इनका उत्तर देने से सबसे अधिक योजनाओं की स्थिति स्पष्ट होगी" : "Answering these would clarify the most schemes"}: {topMissing.map(([k, n]) => `${pickL(factLabel(k === "age" ? "date_of_birth" : k), lang)} (${n})`).join(" · ")}</p>
          )}
          <Link href="/profile" className="btn btn-primary btn-sm">{hi ? "प्रोफ़ाइल पूरी करें" : "Complete profile"}</Link>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section id="s-likely" title={t("dash.likely")} rows={by("eligible")} lang={lang} empty={t("dash.empty")} />
        <Section id="s-partial" title={t("dash.partial")} rows={by("partially_eligible")} lang={lang} empty={t("dash.empty")} />
        <Section id="s-soon" title={t("dash.closing")} rows={soon} lang={lang} empty={hi ? "अगले 30 दिनों में कोई अंतिम तिथि नहीं।" : "No deadlines in the next 30 days."} />
        <Section id="s-review" title={t("dash.review")} rows={by("needs_manual_review")} lang={lang} empty={t("dash.empty")} />
        <Section id="s-saved" title={t("dash.saved")} rows={savedRows} lang={lang} empty={hi ? "किसी योजना पर ☆ दबाकर सहेजें।" : "Save a scheme with ☆ to track it here."} />
        <Section id="s-applied" title={t("dash.applied")} lang={lang} empty="">
          {apps.length === 0 ? <p className="text-ink-2 text-sm">{t("dash.empty")}</p> : (
            <ul className="divide-y divide-line">
              {apps.map((a) => {
                const r = rows.find((x) => x.schemeId === a.schemeId);
                const prog = r ? checklistProgress(r.content, a.checklist as Checklist, vault) : null;
                return (
                  <li key={a.id} className="py-2 space-y-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link href={`/applications/${a.id}`} className="font-semibold">{r?.name ?? a.schemeId}</Link>
                      <Pill tone={a.state === "approved" ? "ok" : a.state === "rejected" ? "bad" : "primary"}>{pickL(APP_STATE_LABEL[a.state as AppState], lang)}</Pill>
                    </div>
                    {prog && (
                      <div className="flex items-center gap-2 text-sm">
                        <progress value={prog.done} max={prog.total} className="w-40" aria-label={hi ? "चेकलिस्ट प्रगति" : "Checklist progress"} />
                        <span>{prog.done}/{prog.total}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section id="s-renew" title={t("dash.renewal")} lang={lang} empty="">
          {renewals.length === 0 ? <p className="text-ink-2 text-sm">{t("dash.empty")}</p> : (
            <ul>{renewals.map((a) => <li key={a.id}><Link href={`/applications/${a.id}`}>{rows.find((r) => r.schemeId === a.schemeId)?.name}</Link></li>)}</ul>
          )}
        </Section>
      </div>

      <section aria-labelledby="ben-h" className="card p-4 space-y-3">
        <h2 id="ben-h" className="font-bold text-lg">{t("dash.benefits")} — {primary.label}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-3">
            <h3 className="font-semibold">{t("dash.stated")}</h3>
            <p className="text-2xl font-bold">{rupees(mine.statedAnnual)} <span className="text-base font-normal">{t("dash.perYear")}</span></p>
            {mine.statedOneTime > 0 && <p>+ {rupees(mine.statedOneTime)} {t("dash.oneTime")}</p>}
            <ul className="text-sm mt-1">{mine.statedLines.map((l) => <li key={l.schemeId}>{pickL(l.name, lang)}: {l.annual ? `${rupees(l.annual)}/${hi ? "वर्ष" : "yr"}` : l.oneTime ? `${rupees(l.oneTime)} ${t("dash.oneTime")}` : ""}</li>)}</ul>
          </div>
          <div className="card p-3">
            <h3 className="font-semibold">{t("dash.estimated")}</h3>
            <p className="text-2xl font-bold">{hi ? "अधिकतम " : "up to "}{rupees(mine.estimatedAnnualMax)} <span className="text-base font-normal">{t("dash.perYear")}</span></p>
            {mine.estimatedOneTimeMax > 0 && <p>+ {hi ? "अधिकतम " : "up to "}{rupees(mine.estimatedOneTimeMax)} {t("dash.oneTime")}</p>}
            <ul className="text-sm mt-1">{mine.estimatedLines.map((l) => <li key={l.schemeId} className={l.countedInTotal ? "" : "line-through text-ink-2"}>{pickL(l.name, lang)}: {l.annual ? `${rupees(l.annual)}/${hi ? "वर्ष" : "yr"}` : l.oneTime ? rupees(l.oneTime) : ""}{!l.countedInTotal && (hi ? " (संयोजित नहीं हो सकती)" : " (cannot be combined)")}</li>)}</ul>
          </div>
        </div>
        {mine.nonCash.length > 0 && (
          <div>
            <h3 className="font-semibold">{t("dash.nonCash")}</h3>
            <ul className="text-sm list-disc pl-5">{mine.nonCash.map((n) => <li key={n.schemeId}>{pickL(n.name, lang)} — {pickL(n.basis, lang)}</li>)}</ul>
          </div>
        )}
        {mine.thirdParty.length > 0 && (
          <div>
            <h3 className="font-semibold">{hi ? "गैर-सरकारी (कॉर्पोरेट/CSR) अवसर — कुल में शामिल नहीं" : "Non-government (corporate/CSR) opportunities — not included in totals"}</h3>
            <ul className="text-sm list-disc pl-5">{mine.thirdParty.map((n) => <li key={n.schemeId}>{pickL(n.name, lang)}{n.amount ? ` — ${hi ? "अधिकतम" : "up to"} ${rupees(n.amount)}` : ""} · {pickL(n.basis, lang)}</li>)}</ul>
          </div>
        )}
        <ul className="text-sm text-ink-2">{mine.notes.map((n, i) => <li key={i}>{pickL(n, lang)}</li>)}</ul>
      </section>

      <section aria-labelledby="hh-h" className="card p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-baseline">
          <h2 id="hh-h" className="font-bold text-lg">{t("dash.household")}</h2>
          <Link href="/profile#members" className="btn btn-sm">{t("profile.addMember")}</Link>
        </div>
        <p className="text-sm text-ink-2">{hi ? "व्यक्तिगत योजनाएँ हर सदस्य के लिए अलग हैं; परिवार-स्तरीय योजनाएँ (जैसे पीएम-किसान, आयुष्मान, उज्ज्वला, आवास) पूरे परिवार के लिए एक बार गिनी जाती हैं।" : "Individual schemes are per member; household-level schemes (e.g. PM-KISAN, Ayushman, Ujjwala, housing) are counted once for the whole family."}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead><tr className="border-b border-line"><th className="py-1 pr-3">{hi ? "सदस्य" : "Member"}</th><th className="py-1 pr-3">{hi ? "व्यक्तिगत (संभवतः पात्र)" : "Individual (likely eligible)"}</th><th className="py-1">{hi ? "परिवार-स्तरीय" : "Household-level"}</th></tr></thead>
            <tbody>
              {household.map((h) => (
                <tr key={h.label} className="border-b border-line align-top">
                  <th scope="row" className="py-2 pr-3">{h.label}</th>
                  <td className="py-2 pr-3">{h.items.filter((i) => i.unit !== "household" && i.result.status === "eligible").map((i) => pickL(i.name, lang)).join(", ") || "—"}</td>
                  <td className="py-2">{h.isPrimary ? h.items.filter((i) => i.unit === "household" && i.result.status === "eligible").map((i) => pickL(i.name, lang)).join(", ") || "—" : (hi ? "मुख्य प्रोफ़ाइल देखें" : "see primary profile")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {household.length > 1 && <p className="text-sm">{hi ? "परिवार का घोषित वार्षिक लाभ" : "Household stated annual benefit"}: <strong>{rupees(hh.statedAnnual)}</strong> · {hi ? "अनुमानित अधिकतम" : "estimated maximum"}: <strong>{rupees(hh.estimatedAnnualMax)}</strong></p>}
      </section>

      <p className="text-sm text-ink-2">{hi ? "सभी परिणाम आपकी दी गई जानकारी पर आधारित हैं और आधिकारिक निर्णय नहीं हैं।" : "All results are based on the information you provided and are not official decisions."} <Link href="/schemes">{t("home.cta.browse")}</Link> · {by("not_eligible").length} {hi ? "संभवतः पात्र नहीं" : "likely not eligible"} · {by("expired_or_closed").length} {hi ? "बंद" : "closed"}</p>
    </div>
  );
}
