import { getT } from "@/lib/i18n/server";
import { FIELDS } from "@/lib/profile/fields";
import { DiscoveryCheck } from "./DiscoveryCheck";

export const metadata = { title: "Quick check" };

export default async function CheckPage() {
  const { lang } = await getT();
  const hi = lang === "hi";
  const keys = [...FIELDS.filter((f) => f.discovery).map((f) => f.key), "gender", "social_category"];
  return (
    <div className="max-w-4xl space-y-3">
      <h1 className="text-2xl font-bold">{hi ? "त्वरित जाँच (बिना खाते के)" : "Quick check (no account)"}</h1>
      <p className="text-ink-2">{hi ? "कुछ बुनियादी प्रश्नों के उत्तर दें। कुछ भी सहेजा नहीं जाता। हर योजना के लिए सटीक परिणाम हेतु योजना पृष्ठ खोलें।" : "Answer a few basic questions. Nothing is saved. Open a scheme for its exact questions and a full explanation."}</p>
      <DiscoveryCheck keys={keys} lang={lang} />
    </div>
  );
}
