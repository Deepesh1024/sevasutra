import { getT } from "@/lib/i18n/server";
import { CONSENTS, NOTICE_VERSION } from "@/lib/consent";
import { pickL } from "@/components/ui";

export const metadata = { title: "Privacy & consent" };

export default async function PrivacyPage() {
  const { lang } = await getT();
  const hi = lang === "hi";
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">{hi ? "गोपनीयता और सहमति मैट्रिक्स" : "Privacy and consent matrix"}</h1>
      <p className="text-ink-2">Notice version {NOTICE_VERSION}. {hi ? "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के सिद्धांतों के अनुसार।" : "Designed around the Digital Personal Data Protection Act, 2023."}</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>{hi ? "फ़ोन OTP केवल प्रमाणीकरण है, पात्रता का प्रमाण नहीं।" : "Phone OTP is authentication only — never proof of eligibility."}</li>
        <li>{hi ? "हम आधार संख्या, बैंक खाता संख्या, OTP या पासवर्ड नहीं माँगते और न ही लॉग करते हैं।" : "We never ask for or log Aadhaar numbers, bank account numbers, OTPs or passwords."}</li>
        <li>{hi ? "नाम, चेहरे, भाषा या पते से जाति, धर्म, दिव्यांगता, आय या कानूनी स्थिति का अनुमान कभी नहीं।" : "Caste, religion, disability, income or legal status are never inferred from your name, face, language or address."}</li>
        <li>{hi ? "नागरिक दस्तावेज़ों पर कोई सामान्य AI मॉडल प्रशिक्षित नहीं किया जाता। डेटा बेचा या विज्ञापन हेतु उपयोग नहीं किया जाता।" : "No general AI model is trained on citizen documents. Data is never sold or used for advertising."}</li>
        <li>{hi ? "एनालिटिक्स छद्मनामी है (चैट सत्र कुंजियाँ हैश की जाती हैं)।" : "Analytics are pseudonymous (chat session keys are hashed)."}</li>
      </ul>
      <div className="overflow-x-auto card">
        <table className="w-full text-sm text-left">
          <thead><tr className="border-b border-line">{["Purpose", "Data", "Legal basis", "Retention", "Sharing", "Deletion"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>{CONSENTS.map((c) => (
            <tr key={c.purpose} className="border-b border-line align-top">
              <th scope="row" className="p-2">{pickL(c.title, lang)}</th>
              <td className="p-2">{pickL(c.data, lang)}</td><td className="p-2">{pickL(c.basis, lang)}</td><td className="p-2">{pickL(c.retention, lang)}</td><td className="p-2">{pickL(c.sharing, lang)}</td><td className="p-2">{pickL(c.deletion, lang)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
