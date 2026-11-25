"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type UploadState } from "@/app/actions/documents";

export function UploadForm({ docTypes, profiles, consentGiven, lang }: { docTypes: { type: string; label: string }[]; profiles: { id: string; label: string }[]; consentGiven: boolean; lang: "en" | "hi" }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocumentAction, {});
  const hi = lang === "hi";
  return (
    <form action={action} className="card p-4 space-y-3" encType="multipart/form-data">
      <h2 className="font-bold text-lg">{hi ? "दस्तावेज़ जोड़ें" : "Add a document"}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="field">
          <label htmlFor="docType">{hi ? "दस्तावेज़ का प्रकार" : "Document type"}</label>
          <select id="docType" name="docType" required defaultValue="">
            <option value="" disabled>—</option>
            {docTypes.map((d) => <option key={d.type} value={d.type}>{d.label}</option>)}
          </select>
        </div>
        {profiles.length > 1 && (
          <div className="field">
            <label htmlFor="docProfile">{hi ? "किसका दस्तावेज़" : "Whose document"}</label>
            <select id="docProfile" name="profileId">{profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
          </div>
        )}
        <div className="field">
          <label htmlFor="file">{hi ? "फ़ाइल चुनें (PDF, JPG, PNG, अधिकतम 5 MB)" : "Choose a file (PDF, JPG, PNG, max 5 MB)"}</label>
          <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" />
        </div>
        <div className="field">
          <label htmlFor="camera">{hi ? "या फ़ोटो लें" : "Or take a photo"}</label>
          <input id="camera" name="camera" type="file" accept="image/*" capture="environment" />
        </div>
        <div className="field">
          <label htmlFor="issuedAt">{hi ? "जारी होने की तिथि (वैकल्पिक)" : "Issue date (optional)"}</label>
          <input id="issuedAt" name="issuedAt" type="date" max={new Date().toISOString().slice(0, 10)} />
          <p className="help">{hi ? "समाप्ति याद दिलाने के लिए उपयोग।" : "Used to remind you before it expires."}</p>
        </div>
      </div>
      <p className="help">{hi ? "आधार के लिए, केवल अंतिम 4 अंक दिखाने वाली मास्क्ड प्रति अपलोड करें। सामग्री एन्क्रिप्टेड रहती है और कभी लॉग नहीं होती।" : "For Aadhaar, upload a masked copy showing only the last 4 digits. Contents are encrypted and never logged."}</p>
      {!consentGiven && (
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" name="consent_documents" className="mt-1 w-5 h-5" required /><span>{hi ? "मैं अपने दस्तावेज़ों को सेवासूत्र की एन्क्रिप्टेड तिजोरी में रखने की सहमति देता/देती हूँ। मैं इन्हें कभी भी हटा सकता/सकती हूँ।" : "I consent to SevaSutra storing my documents in its encrypted vault. I can delete them at any time."} <a href="/privacy">{hi ? "विवरण" : "Details"}</a></span></label>
      )}
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" name="allow_duplicate" className="w-4 h-4" />{hi ? "यदि यही फ़ाइल पहले से है तो भी दूसरी प्रति रखें" : "Store a second copy even if this exact file is already in my vault"}</label>
      {state.error && <p role="alert" className="text-bad font-semibold">{state.error}</p>}
      {state.rejected && <p className="text-sm text-ink-2">{hi ? "अस्वीकृत फ़ाइल संग्रहीत नहीं की गई।" : "The rejected file was not stored."}</p>}
      {state.ok && <p role="status" className="text-ok font-semibold">✓ {hi ? "दस्तावेज़ जाँचा गया और सुरक्षित रूप से सहेजा गया।" : "Document checked and stored securely."} <span className="font-normal text-ink">{state.note}</span></p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? (hi ? "दस्तावेज़ पढ़ा और जाँचा जा रहा है…" : "Reading and checking your document…") : hi ? "अपलोड करें" : "Upload"}</button>
      <p className="help">{hi ? "अपलोड के बाद दस्तावेज़ हमारे सर्वर पर पढ़ा (OCR) जाता है और AI जाँचता है कि यह चुना गया दस्तावेज़ ही है। पाठ न पढ़ा जा सके तो AI छवि देखता है (आधार या बैंक दस्तावेज़ों के लिए कभी नहीं)। गलत या अपठनीय दस्तावेज़ अस्वीकार कर दिए जाते हैं।" : "After upload, the document is read on our server (OCR) and an AI check confirms it is the document type you chose. If the text can't be read, the AI looks at the image instead (never for Aadhaar or bank documents). Wrong or unreadable documents are rejected."}</p>
    </form>
  );
}
