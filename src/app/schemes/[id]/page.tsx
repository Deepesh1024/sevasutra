import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { contentOf, freshness, getPublished } from "@/lib/schemes/repo";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getProfiles, factInputFor, hasConsent } from "@/lib/profile/service";
import { evaluateAndRecord } from "@/lib/eval/service";
import { factsReferenced } from "@/lib/engine/evaluate";
import { FIELD_MAP } from "@/lib/profile/fields";
import { resolveFact } from "@/lib/engine/facts";
import { EligibilityResultView } from "@/components/EligibilityResultView";
import { QuickCheck } from "@/components/QuickCheck";
import { FieldInput } from "@/components/FieldInput";
import { FeedbackForm } from "@/components/FeedbackForm";
import { BENEFIT_LABEL, ExternalLink, LEVEL_LABEL, MODE_LABEL, Pill, fmtDate, pickL } from "@/components/ui";
import { answerQuestionsAction, startApplicationAction, toggleSaveAction } from "@/app/actions/schemes";
import { rupees } from "@/lib/format";
import { isApplicant } from "@/lib/auth/roles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const v = await getPublished((await params).id);
  return { title: v?.name ?? "Scheme" };
}

export default async function SchemePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ profile?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await getPublished(id);
  if (!v) notFound();
  const c = contentOf(v);
  const { t, lang, L, hasTranslation } = await getT();
  const user = await currentUser();
  const fresh = freshness(v);
  const sources = await db.source.findMany({ where: { id: { in: c.sources.map((s) => s.sourceId) } } });
  const primarySource = sources.find((s) => s.id === c.sources[0]?.sourceId);

  const keys = new Set<string>();
  factsReferenced(c.rule.mandatory, keys);
  for (const ex of c.rule.exceptions ?? []) factsReferenced(ex.when, keys);
  if (c.stateScope.length) keys.add("state");
  const questionKeys = [...keys].filter((k) => FIELD_MAP[k]);
  if (questionKeys.includes("date_of_birth")) questionKeys.splice(questionKeys.indexOf("date_of_birth") + 1, 0, "age_band");

  const meta = { versionLabel: `v${v.version}`, sourceTitle: primarySource?.title, sourceUrl: primarySource?.url, lastVerified: v.lastVerifiedAt, effectiveFrom: c.effectiveFrom };

  let eligibility: React.ReactNode;
  let saved = false;
  let profileId: string | undefined;
  if (user && isApplicant(user)) {
    const profiles = await getProfiles(user.id);
    const profile = profiles.find((p) => p.id === sp.profile) ?? profiles[0];
    profileId = profile.id;
    const { evaluation, result } = await evaluateAndRecord(user.id, profile.id, v);
    const input = await factInputFor(profile.id);
    const missingKeys = questionKeys.filter((k) => {
      const r = resolveFact(input[k], new Date());
      return r.state !== "known";
    }).filter((k) => !(k === "age_band" && input["date_of_birth"]) && !(k === "date_of_birth" && input["age_band"]));
    const sensitiveAsked = missingKeys.some((k) => FIELD_MAP[k]?.sensitive);
    const sensitiveConsent = await hasConsent(user.id, "profile_sensitive");
    saved = !!(await db.savedScheme.findUnique({ where: { userId_schemeId: { userId: user.id, schemeId: id } } }));
    eligibility = (
      <div className="space-y-4">
        {profiles.length > 1 && (
          <form method="get" className="flex items-end gap-2">
            <div className="field"><label htmlFor="pf">{lang === "hi" ? "किसके लिए जाँचें" : "Check for"}</label>
              <select id="pf" name="profile" defaultValue={profile.id}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </div>
            <button className="btn">{lang === "hi" ? "बदलें" : "Switch"}</button>
          </form>
        )}
        <EligibilityResultView result={result} lang={lang} meta={{ ...meta, checkedAt: evaluation.createdAt, evaluationId: evaluation.id }} />
        {missingKeys.length > 0 && (
          <form action={answerQuestionsAction} className="card p-4 space-y-3" aria-labelledby="ans-h">
            <h4 id="ans-h" className="font-bold">{t("elig.completeProfile")}</h4>
            <input type="hidden" name="schemeId" value={id} />
            <input type="hidden" name="profileId" value={profile.id} />
            <input type="hidden" name="keys" value={missingKeys.join(",")} />
            <div className="grid gap-3 md:grid-cols-2">
              {missingKeys.map((k) => <FieldInput key={k} field={FIELD_MAP[k]} lang={lang} idPrefix="ans" value={input[k]?.[0]?.value ?? undefined} />)}
            </div>
            {sensitiveAsked && !sensitiveConsent && (
              <label className="flex gap-2 items-start text-sm">
                <input type="checkbox" name="consent_sensitive" className="mt-1 w-5 h-5" />
                <span>{lang === "hi" ? "मैं सामाजिक श्रेणी / दिव्यांगता / मातृत्व जैसे संवेदनशील उत्तरों के उपयोग की सहमति देता/देती हूँ (केवल पात्रता जाँच के लिए)।" : "I consent to SevaSutra using sensitive answers such as social category, disability or maternity — only to check eligibility."} <Link href="/privacy">{t("common.learnMore")}</Link></span>
              </label>
            )}
            <button className="btn btn-primary">{t("profile.save")}</button>
          </form>
        )}
      </div>
    );
  } else {
    eligibility = (
      <div className="space-y-3">
        {user && !isApplicant(user) && <p className="text-sm">{lang === "hi" ? "एक्सप्लोरर के रूप में आप जाँच कर सकते हैं, पर उत्तर सहेजे नहीं जाते। " : "As an explorer you can check, but answers are not saved. "}<Link href={`/login/verify-phone?next=/schemes/${id}`}>{lang === "hi" ? "मोबाइल सत्यापित करें" : "Verify your mobile"}</Link></p>}
        <h4 className="font-semibold">{t("elig.answer")}</h4>
        <QuickCheck schemeId={id} keys={questionKeys} lang={lang} meta={meta} />
      </div>
    );
    if (user) saved = !!(await db.savedScheme.findUnique({ where: { userId_schemeId: { userId: user.id, schemeId: id } } }));
  }

  const b = c.benefit;
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <nav aria-label="Breadcrumb" className="text-sm"><Link href="/schemes">{t("nav.schemes")}</Link> › {c.ministry}</nav>
        <div className="flex flex-wrap gap-2">
          <Pill tone="primary">{pickL(LEVEL_LABEL[c.level], lang)}{c.stateScope.length ? ` · ${c.stateScope.join(", ")}` : ""}</Pill>
          <Pill>{pickL(MODE_LABEL[c.application.mode], lang)}</Pill>
          {c.lifecycleStatus !== "open" && <Pill tone="bad">{c.lifecycleStatus}</Pill>}
        </div>
        <h1 className="text-3xl font-bold leading-tight">{L(c.name)}</h1>
        <p className="text-ink-2">{c.ministry}{c.department ? ` · ${c.department}` : ""}</p>
        {c.isThirdParty && (
          <div role="note" className="card p-3 bg-warn-soft text-ink">
            <strong>{t("scheme.thirdParty")}.</strong> {lang === "hi" ? "प्रदाता" : "Provider"}: {c.provider?.name}.{" "}
            {c.provider?.privacyUrl && <ExternalLink href={c.provider.privacyUrl}>{lang === "hi" ? "गोपनीयता नीति" : "Privacy policy"}</ExternalLink>}{" · "}
            {c.provider?.termsUrl && <ExternalLink href={c.provider.termsUrl}>{lang === "hi" ? "शर्तें" : "Terms"}</ExternalLink>}
          </div>
        )}
        {fresh !== "fresh" && <p role="note" className="card p-3 bg-warn-soft text-warn font-semibold">{fresh === "unverified" ? t("scheme.unverified") : t("scheme.stale")}</p>}
        <p className="text-sm text-ink-2">
          {t("scheme.version")} {v.version} · {t("scheme.effective")} {fmtDate(c.effectiveFrom, lang)} · {t("scheme.lastVerified")}: {v.lastVerifiedAt ? fmtDate(v.lastVerifiedAt, lang) : t("scheme.never")} · {lang === "hi" ? "डेटा विश्वसनीयता" : "Data confidence"}: {c.dataConfidence}
        </p>
        <div className="flex flex-wrap gap-2">
          {user && (
            <form action={toggleSaveAction}><input type="hidden" name="schemeId" value={id} /><button className="btn" aria-pressed={saved}>{saved ? `★ ${t("scheme.saved")}` : `☆ ${t("scheme.save")}`}</button></form>
          )}
          <Link href={`/compare?ids=${id}`} className="btn">{t("scheme.compare")}</Link>
          <a href="#feedback" className="btn">{t("scheme.report")}</a>
        </div>
      </header>

      <section aria-labelledby="sum-h" className="card p-5 space-y-2">
        <h2 id="sum-h" className="sr-only">Summary</h2>
        <p className="text-lg">{L(c.summary)}</p>
        {!hasTranslation(c.summary) && <p className="help">Hindi translation not yet available.</p>}
        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t("scheme.originalText")}</summary>
          <blockquote lang="en" className="mt-2 border-l-4 border-line pl-3 text-sm">{c.officialDescription.en}</blockquote>
          {primarySource && <p className="text-sm mt-1">— <ExternalLink href={primarySource.url}>{primarySource.title}</ExternalLink></p>}
        </details>
      </section>

      <section id="eligibility" aria-labelledby="elig-h" className="card p-5 space-y-3">
        <h2 id="elig-h" className="text-xl font-bold">{t("scheme.eligibility")}</h2>
        {eligibility}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="ben-h" className="card p-5 space-y-2">
          <h2 id="ben-h" className="text-xl font-bold">{t("scheme.benefit")}</h2>
          <p><Pill>{pickL(BENEFIT_LABEL[b.kind], lang)}</Pill></p>
          {b.amountMax !== undefined && (
            <p className="text-lg font-semibold">{b.amountMin !== undefined && b.amountMin !== b.amountMax ? `${rupees(b.amountMin)} – ` : !b.stated ? (lang === "hi" ? "अधिकतम " : "Up to ") : ""}{rupees(b.amountMax)}{b.frequency ? ` (${b.frequency.replace(/_/g, " ")})` : ""}</p>
          )}
          <p className="text-sm"><strong>{lang === "hi" ? "आधार" : "Basis"}:</strong> {L(b.basis)}</p>
          {!b.countsAsMoney && <p className="text-sm text-ink-2">{lang === "hi" ? "यह नकद राशि नहीं है और डैशबोर्ड के कुल योग में नहीं जोड़ी जाती।" : "This is not cash and is not added to dashboard totals."}</p>}
        </section>

        <section aria-labelledby="docs-h" className="card p-5 space-y-2">
          <h2 id="docs-h" className="text-xl font-bold">{t("scheme.documents")}</h2>
          <ul className="space-y-2">
            {c.documents.map((d) => (
              <li key={d.type}>
                <span className="font-semibold">{L(d.label)}</span> <Pill tone={d.required ? "primary" : "muted"}>{d.required ? (lang === "hi" ? "आवश्यक" : "Required") : lang === "hi" ? "वैकल्पिक" : "Optional"}</Pill>
                {d.onlyIf && <span className="help block">{lang === "hi" ? "केवल लागू होने पर" : "Only if applicable to you"}</span>}
                {d.alternatives?.length ? <span className="help block">{lang === "hi" ? "विकल्प" : "Alternatives"}: {d.alternatives.join(", ").replace(/_/g, " ")}</span> : null}
              </li>
            ))}
          </ul>
          {isApplicant(user) && <Link href="/documents" className="btn btn-sm">{lang === "hi" ? "दस्तावेज़ तिजोरी खोलें" : "Open document vault"}</Link>}
        </section>
      </div>

      <section aria-labelledby="apply-h" className="card p-5 space-y-3">
        <h2 id="apply-h" className="text-xl font-bold">{t("scheme.howToApply")}</h2>
        <ol className="list-decimal pl-5 space-y-1">{c.application.steps.map((s, i) => <li key={i}>{L(s)}</li>)}</ol>
        <dl className="grid sm:grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">{t("scheme.deadline")}</dt><dd>{c.application.deadline ? fmtDate(c.application.deadline, lang) : t("scheme.noDeadline")}{c.application.deadlineNote ? ` — ${L(c.application.deadlineNote)}` : ""}</dd>
          <dt className="font-semibold">{t("scheme.fee")}</dt><dd>{L(c.application.fee)}</dd>
          {c.application.renewal && <><dt className="font-semibold">{t("scheme.renewal")}</dt><dd>{L(c.application.renewal)}</dd></>}
          <dt className="font-semibold">{t("scheme.status")}</dt><dd>{L(c.application.statusTracking)}</dd>
          <dt className="font-semibold">{t("scheme.grievance")}</dt><dd>{L(c.application.grievance)}</dd>
        </dl>
        <div className="flex flex-wrap gap-2 items-center">
          {c.application.url && c.application.mode !== "unavailable" && (
            <ExternalLink href={c.application.url} className="btn btn-primary">{c.isThirdParty ? t("scheme.openProvider") : t("scheme.openPortal")}</ExternalLink>
          )}
          {c.application.mode !== "unavailable" && (isApplicant(user) ? (
            <form action={startApplicationAction}>
              <input type="hidden" name="schemeId" value={id} />
              {profileId && <input type="hidden" name="profileId" value={profileId} />}
              <button className="btn">{lang === "hi" ? "आवेदन चेकलिस्ट शुरू करें" : "Start my application checklist"}</button>
            </form>
          ) : (
            <p className="text-sm">{lang === "hi" ? "चेकलिस्ट सहेजने के लिए " : "To keep a checklist, "}<Link href={`/login?next=/schemes/${id}`}>{lang === "hi" ? "मोबाइल से साइन इन करें" : "sign in with your mobile"}</Link>.</p>
          ))}
        </div>
        <p className="help">{lang === "hi" ? "सेवासूत्र आपकी ओर से आवेदन जमा नहीं करता। आप आधिकारिक पोर्टल पर स्वयं आवेदन करते हैं।" : "SevaSutra does not submit applications for you. You apply yourself on the official portal."}</p>
      </section>

      <section aria-labelledby="src-h" className="card p-5 space-y-2">
        <h2 id="src-h" className="text-xl font-bold">{t("scheme.sources")}</h2>
        <ul className="space-y-1">
          {c.sources.map((s) => {
            const src = sources.find((x) => x.id === s.sourceId);
            if (!src) return null;
            return (
              <li key={s.sourceId} className="text-sm">
                <ExternalLink href={src.url}>{src.title}</ExternalLink> — {src.publisher}{s.section ? ` · ${s.section}` : ""}{" "}
                {src.isOfficial ? <Pill tone="ok">{t("scheme.official")}</Pill> : <Pill tone="warn">{lang === "hi" ? "तृतीय-पक्ष" : "Third-party"}</Pill>}
                {src.lastHttpStatus && src.lastHttpStatus >= 400 && <Pill tone="bad">link broken ({src.lastHttpStatus})</Pill>}
              </li>
            );
          })}
        </ul>
      </section>

      <section id="feedback" aria-labelledby="fb-h" className="card p-5 space-y-2">
        <h2 id="fb-h" className="text-xl font-bold">{t("scheme.report")}</h2>
        <FeedbackForm schemeId={id} lang={lang} />
      </section>
    </article>
  );
}
