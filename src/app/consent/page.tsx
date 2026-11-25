import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { CONSENTS, NOTICE_VERSION } from "@/lib/consent";
import { hasConsent } from "@/lib/profile/service";
import { grantConsentsAction } from "@/app/actions/profile";
import { pickL } from "@/components/ui";
import { isApplicant } from "@/lib/auth/roles";

export const metadata = { title: "Privacy notice and consent" };

export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/profile", error } = await searchParams;
  const user = await requireUser("/consent");
  const { lang } = await getT();
  const hi = lang === "hi";
  const granted = Object.fromEntries(await Promise.all(CONSENTS.map(async (c) => [c.purpose, await hasConsent(user.id, c.purpose)] as const)));
  const shown = CONSENTS.filter((c) => c.purpose !== "guardian_minor" && (c.purpose !== "documents" || isApplicant(user)));
  return (
    <form action={grantConsentsAction} className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{hi ? "सूचना और सहमति" : "Notice and consent"}</h1>
      <p>{hi ? "कोई भी जानकारी सहेजने से पहले, कृपया पढ़ें कि हम क्या रखते हैं, क्यों, कितने समय तक और आप इसे कैसे हटा सकते हैं।" : "Before we save anything, here is what we keep, why, for how long, and how you can remove it."} <span className="text-ink-2 text-sm">(notice {NOTICE_VERSION})</span></p>
      <p className="text-sm">{hi ? "सेवासूत्र आधार संख्या, बैंक खाता संख्या या पासवर्ड नहीं माँगता। आपके नाम, पते या भाषा से जाति, धर्म, दिव्यांगता या आय का अनुमान कभी नहीं लगाया जाता।" : "SevaSutra never asks for your Aadhaar number, bank account number or passwords, and never infers caste, religion, disability or income from your name, address or language."}</p>
      {error === "required" && <p role="alert" className="text-bad font-semibold">{hi ? "प्रोफ़ाइल सहेजने के लिए पहली सहमति आवश्यक है।" : "The first consent is required to save a profile."}</p>}
      <input type="hidden" name="next" value={next} />
      {shown.map((c) => (
        <fieldset key={c.purpose} className="card p-4 space-y-2">
          <legend className="sr-only">{pickL(c.title, lang)}</legend>
          <label className="flex gap-3 items-start font-semibold">
            <input type="checkbox" name={c.purpose} defaultChecked={granted[c.purpose]} disabled={granted[c.purpose]} className="mt-1 w-5 h-5" />
            <span>{pickL(c.title, lang)} {c.required ? <span className="text-bad">*</span> : <span className="text-ink-2 font-normal">({hi ? "वैकल्पिक" : "optional"})</span>} {granted[c.purpose] && <span className="text-ok text-sm">✓ {hi ? "दी गई" : "given"}</span>}</span>
          </label>
          <dl className="grid sm:grid-cols-[9rem_1fr] gap-x-3 text-sm">
            <dt className="font-semibold">{hi ? "डेटा" : "Data"}</dt><dd>{pickL(c.data, lang)}</dd>
            <dt className="font-semibold">{hi ? "आधार" : "Legal basis"}</dt><dd>{pickL(c.basis, lang)}</dd>
            <dt className="font-semibold">{hi ? "अवधि" : "Retention"}</dt><dd>{pickL(c.retention, lang)}</dd>
            <dt className="font-semibold">{hi ? "साझाकरण" : "Sharing"}</dt><dd>{pickL(c.sharing, lang)}</dd>
            <dt className="font-semibold">{hi ? "हटाना" : "Deletion"}</dt><dd>{pickL(c.deletion, lang)}</dd>
          </dl>
        </fieldset>
      ))}
      <p className="text-sm text-ink-2">{hi ? "आप खाता सेटिंग्स से कभी भी सहमति वापस ले सकते हैं।" : "You can withdraw any consent at any time from Account settings."}</p>
      <button className="btn btn-primary">{hi ? "सहेजें और जारी रखें" : "Save and continue"}</button>
    </form>
  );
}
