import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireApplicant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contentOf, getPublished } from "@/lib/schemes/repo";
import { vaultDocTypes } from "@/lib/eval/service";
import { hasConsent } from "@/lib/profile/service";
import { APP_STATE_LABEL, USER_SETTABLE, checklistProgress, type AppState, type Checklist } from "@/lib/applications";
import { OpenPortalButton } from "@/components/OpenPortalButton";
import { Pill, fmtDate, pickL } from "@/components/ui";
import { reportStatusAction, updateChecklistAction } from "@/app/actions/applications";

export const metadata = { title: "Application checklist" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireApplicant(`/applications/${id}`);
  const app = await db.application.findFirst({ where: { id, userId: user.id } });
  if (!app) notFound();
  const v = await getPublished(app.schemeId);
  if (!v) notFound();
  const c = contentOf(v);
  const { lang, L } = await getT();
  const hi = lang === "hi";
  const reuse = await hasConsent(user.id, "document_reuse");
  const vault = reuse ? await vaultDocTypes(user.id, app.profileId) : [];
  const cl = (app.checklist as Checklist) ?? {};
  const prog = checklistProgress(c, cl, vault);
  const profile = await db.profile.findUnique({ where: { id: app.profileId } });
  const history = await db.auditEvent.findMany({ where: { entityType: "application", entityId: id }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-2">
        <nav className="text-sm"><Link href="/dashboard">{hi ? "डैशबोर्ड" : "Dashboard"}</Link> › <Link href={`/schemes/${v.schemeId}`}>{L(c.name)}</Link></nav>
        <h1 className="text-2xl font-bold">{hi ? "आवेदन चेकलिस्ट" : "Application checklist"}: {L(c.name)}</h1>
        <p>{hi ? "सदस्य" : "For"}: <strong>{profile?.label}</strong> · <Pill tone="primary">{pickL(APP_STATE_LABEL[app.state as AppState], lang)}</Pill> {app.externalRef && <>· {hi ? "संदर्भ" : "Reference"}: <code>{app.externalRef}</code></>}</p>
        <div className="flex items-center gap-2"><progress value={prog.done} max={prog.total} className="w-64" aria-label={hi ? "प्रगति" : "Progress"} /> <span>{prog.done}/{prog.total} ({prog.pct}%)</span></div>
      </header>

      <form action={updateChecklistAction} className="card p-4 space-y-4">
        <input type="hidden" name="id" value={id} />
        <fieldset className="space-y-1">
          <legend className="font-bold text-lg">1. {hi ? "दस्तावेज़ तैयार रखें" : "Get your documents ready"}</legend>
          {c.documents.map((d) => {
            const inVault = [d.type, ...(d.alternatives ?? [])].some((t) => vault.includes(t));
            return (
              <label key={d.type} className="flex gap-2 items-start min-h-[40px]">
                <input type="checkbox" name={`doc:${d.type}`} defaultChecked={!!cl.docs?.[d.type] || inVault} className="mt-1 w-5 h-5" />
                <span>{L(d.label)} {d.required ? "" : <span className="text-ink-2">({hi ? "वैकल्पिक" : "optional"})</span>} {inVault && <Pill tone="ok">{hi ? "तिजोरी में" : "in vault"}</Pill>}
                  {d.alternatives?.length ? <span className="help block">{hi ? "विकल्प" : "Or"}: {d.alternatives.join(", ").replace(/_/g, " ")}</span> : null}</span>
              </label>
            );
          })}
          {!reuse && <p className="help">{hi ? "तिजोरी के दस्तावेज़ों को स्वतः टिक करने के लिए" : "To tick documents from your vault automatically,"} <Link href={`/consent?next=/applications/${id}`}>{hi ? "दस्तावेज़ पुनः उपयोग की सहमति दें" : "allow document reuse"}</Link>.</p>}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="font-bold text-lg">2. {hi ? "आधिकारिक पोर्टल पर चरण" : "Steps on the official portal"}</legend>
          {c.application.steps.map((s, i) => (
            <label key={i} className="flex gap-2 items-start min-h-[40px]">
              <input type="checkbox" name={`step:${i}`} defaultChecked={!!cl.steps?.[String(i)]} className="mt-1 w-5 h-5" />
              <span>{L(s)}</span>
            </label>
          ))}
        </fieldset>
        <input type="hidden" name="allDone" value={prog.docsReady ? "1" : "0"} />
        <button className="btn">{hi ? "चेकलिस्ट सहेजें" : "Save checklist"}</button>
      </form>

      <section className="card p-4 space-y-3" aria-labelledby="apply-h">
        <h2 id="apply-h" className="font-bold text-lg">3. {hi ? "आधिकारिक पोर्टल पर आवेदन करें" : "Apply on the official portal"}</h2>
        <p>{hi ? "पोर्टल नए टैब में खुलेगा। सेवासूत्र फ़ॉर्म नहीं भरता, CAPTCHA/OTP नहीं डालता और भुगतान नहीं करता।" : "The portal opens in a new tab. SevaSutra does not fill forms, enter CAPTCHAs/OTPs or make payments for you."}</p>
        {c.application.url ? <OpenPortalButton appId={id} url={c.application.url} label={c.isThirdParty ? (hi ? "प्रदाता की वेबसाइट खोलें" : "Open provider's website") : (hi ? "आधिकारिक पोर्टल खोलें" : "Open official portal")} /> : <p>{L(c.application.steps[0])}</p>}
        {app.redirectedAt && <p className="text-sm text-ink-2">{hi ? "पोर्टल खोला गया" : "Portal opened"}: {fmtDate(app.redirectedAt, lang)}. {hi ? "इसका अर्थ यह नहीं कि आवेदन जमा हो गया।" : "This does not mean an application was submitted."}</p>}
      </section>

      <form action={reportStatusAction} className="card p-4 space-y-3" aria-labelledby="st-h">
        <h2 id="st-h" className="font-bold text-lg">4. {hi ? "पोर्टल पर क्या हुआ? (आप बताएँ)" : "What happened on the portal? (you tell us)"}</h2>
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="field"><label htmlFor="st">{hi ? "स्थिति" : "Status"}</label>
            <select id="st" name="state" defaultValue={USER_SETTABLE.includes(app.state as AppState) ? app.state : "submitted_externally"}>{USER_SETTABLE.map((s) => <option key={s} value={s}>{pickL(APP_STATE_LABEL[s], lang)}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="ref">{hi ? "संदर्भ / आवेदन संख्या" : "Reference / application number"}</label><input id="ref" name="externalRef" defaultValue={app.externalRef ?? ""} maxLength={40} /></div>
          <div className="field"><label htmlFor="ren">{hi ? "नवीनीकरण तिथि (यदि हो)" : "Renewal date (if any)"}</label><input id="ren" name="renewalDueAt" type="date" defaultValue={app.renewalDueAt?.toISOString().slice(0, 10) ?? ""} /></div>
        </div>
        <p className="help">{L(c.application.statusTracking)}</p>
        <button className="btn btn-primary">{hi ? "स्थिति अपडेट करें" : "Update status"}</button>
      </form>

      <section className="card p-4" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-bold text-lg">{hi ? "इतिहास" : "History"}</h2>
        <ol className="text-sm">{history.map((h) => <li key={h.id}>{fmtDate(h.createdAt, lang)} {h.createdAt.toISOString().slice(11, 16)} UTC — {h.action.replace("application.", "").replace(/_/g, " ")}</li>)}</ol>
      </section>
    </div>
  );
}
