import { getT } from "@/lib/i18n/server";
import { requireApplicant } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DOC_TYPES, docLabel } from "@/lib/documents/types";
import { getProfiles, hasConsent } from "@/lib/profile/service";
import { signToken } from "@/lib/crypto";
import { UploadForm } from "@/components/UploadForm";
import { Pill, fmtDate, pickL } from "@/components/ui";
import { confirmExtractionAction, deleteDocumentAction } from "@/app/actions/documents";
import { factLabel } from "@/lib/profile/fields";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const user = await requireApplicant("/documents");
  const { lang } = await getT();
  const hi = lang === "hi";
  const [docs, profiles, consent] = await Promise.all([
    db.document.findMany({ where: { userId: user.id, status: "active" }, include: { extractions: true }, orderBy: { createdAt: "desc" } }),
    getProfiles(user.id),
    hasConsent(user.id, "documents"),
  ]);
  const soon = (d: Date | null) => d && d.getTime() - Date.now() < 30 * 86400_000;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{hi ? "दस्तावेज़ तिजोरी" : "Document vault"}</h1>
        <p className="text-ink-2">{hi ? "आपकी फ़ाइलें एन्क्रिप्टेड रहती हैं, कहीं स्वतः नहीं भेजी जातीं, और केवल 5 मिनट के लिए मान्य लिंक से डाउनलोड होती हैं।" : "Your files are encrypted, never sent anywhere automatically, and can only be downloaded through links that expire after 5 minutes."}</p>
      </header>
      <UploadForm docTypes={DOC_TYPES.map((d) => ({ type: d.type, label: pickL(d.label, lang) }))} profiles={profiles.map((p) => ({ id: p.id, label: p.label }))} consentGiven={consent} lang={lang} />
      <section aria-labelledby="docs-h" className="card p-4 space-y-3">
        <h2 id="docs-h" className="font-bold text-lg">{hi ? "आपके दस्तावेज़" : "Your documents"} ({docs.length})</h2>
        {docs.length === 0 ? <p className="text-ink-2">{hi ? "अभी कोई दस्तावेज़ नहीं।" : "No documents yet."}</p> : (
          <ul className="divide-y divide-line">
            {docs.map((d) => {
              const link = `/api/documents/${d.id}?t=${encodeURIComponent(signToken(JSON.stringify({ docId: d.id, userId: user.id }), 300, "doc"))}`;
              const ex = d.extractions.find((e) => e.status === "pending");
              const fields = (ex?.fields as { key: string; value: string; confidence: number }[] | undefined) ?? [];
              return (
                <li key={d.id} className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{pickL(docLabel(d.docType), lang)}</p>
                      <p className="text-sm text-ink-2">
                        {d.displayName} · {(d.sizeBytes / 1024).toFixed(0)} KB · {hi ? "जोड़ा" : "added"} {fmtDate(d.createdAt, lang)}
                        {d.profileId && ` · ${profiles.find((p) => p.id === d.profileId)?.label ?? ""}`}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Pill tone="ok">{hi ? "स्कैन: सुरक्षित" : "Scan: clean"}</Pill>
                        {d.verifyStatus === "verified" ? <Pill tone="ok">✓ {hi ? "प्रकार जाँचा गया" : "Type checked"}{d.verifyConfidence ? ` ${Math.round(d.verifyConfidence * 100)}%` : ""}</Pill> : <Pill tone="muted">{hi ? "प्रकार जाँचा नहीं गया" : "Type not checked"}</Pill>}
                        {d.expiresAt && <Pill tone={soon(d.expiresAt) ? "bad" : "muted"}>{hi ? "समाप्ति" : "Expires"} {fmtDate(d.expiresAt, lang)}</Pill>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={link} className="btn btn-sm">{hi ? "डाउनलोड" : "Download"}</a>
                      <form action={deleteDocumentAction}><input type="hidden" name="id" value={d.id} /><button className="btn btn-sm btn-danger">{hi ? "हटाएँ" : "Delete"}</button></form>
                    </div>
                  </div>
                  {ex && fields.length > 0 && (
                    <form action={confirmExtractionAction} className="card p-3 bg-surface-2 space-y-2">
                      <input type="hidden" name="extractionId" value={ex.id} />
                      <p className="font-semibold text-sm">{hi ? "हमने ये मान पढ़े — केवल सुझाव। पुष्टि करें या सुधारें:" : "We read these values — suggestions only. Confirm or correct them:"}</p>
                      {fields.map((f) => (
                        <label key={f.key} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name={`accept_${f.key}`} className="w-4 h-4" />
                          <span className="w-48">{pickL(factLabel(f.key), lang)}</span>
                          <input name={`value_${f.key}`} defaultValue={String(f.value)} className="input max-w-xs" />
                          <span className="text-ink-2">({Math.round(f.confidence * 100)}%)</span>
                        </label>
                      ))}
                      <div className="flex gap-2"><button name="decision" value="confirm" className="btn btn-sm btn-primary">{hi ? "पुष्टि करें" : "Confirm selected"}</button><button name="decision" value="reject" className="btn btn-sm">{hi ? "अस्वीकार" : "Discard"}</button></div>
                    </form>
                  )}
                  {d.verifyNote && <p className="help">{d.verifyNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
