import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { HeroBanner, type Slide } from "@/components/HeroBanner";
import { getPublished, contentOf } from "@/lib/schemes/repo";

export default async function Home() {
  const { t, lang } = await getT();
  const [schemes, scholarships] = await Promise.all([
    db.schemeVersion.count({ where: { status: "published", kind: "scheme" } }),
    db.schemeVersion.count({ where: { status: "published", kind: "scholarship" } }),
  ]);
  const hi = lang === "hi";
  const featured: [string, Slide["tone"], string, string][] = [
    ["pm-kisan", "blue", "Farmers", "किसान"],
    ["ab-pmjay", "orange", "Health", "स्वास्थ्य"],
    ["post-matric-sc", "blue", "Scholarships", "छात्रवृत्ति"],
    ["pmuy", "orange", "Women & households", "महिलाएँ और परिवार"],
    ["ignoaps", "blue", "Senior citizens", "वरिष्ठ नागरिक"],
    ["pmay-u-2", "orange", "Housing", "आवास"],
  ];
  const slides: Slide[] = [];
  for (const [id, tone, en, hiLabel] of featured) {
    const v = await getPublished(id);
    if (!v) continue;
    const c = contentOf(v);
    slides.push({
      id, tone, eyebrow: hi ? hiLabel : en,
      title: hi ? c.name.hi ?? c.name.en : c.name.en,
      text: hi ? c.summary.hi ?? c.summary.en : c.summary.en,
      href: `/schemes/${id}`,
      cta: hi ? "पात्रता जाँचें" : "Check eligibility",
    });
  }
  const quick: [string, string][] = [
    ["scholarship", hi ? "छात्रवृत्ति" : "Scholarships"],
    ["pension", hi ? "पेंशन" : "Pension"],
    ["farmer", hi ? "किसान" : "Farmers"],
    ["women", hi ? "महिलाएँ" : "Women"],
    ["housing", hi ? "आवास" : "Housing"],
    ["insurance", hi ? "बीमा" : "Insurance"],
  ];
  return (
    <div className="space-y-10">
      <HeroBanner
        slides={slides}
        labels={{
          prev: hi ? "पिछली स्लाइड" : "Previous slide", next: hi ? "अगली स्लाइड" : "Next slide",
          pause: hi ? "रोकें" : "Pause", play: hi ? "चलाएँ" : "Play", slide: hi ? "प्रमुख योजनाएँ" : "Featured schemes",
          note: hi ? "आधिकारिक स्रोतों से जानकारी · सेवासूत्र सरकारी वेबसाइट नहीं है" : "Information from official sources · SevaSutra is not a government website",
        }}
      />
      <section className="grid gap-6 md:grid-cols-[3fr_2fr] items-start">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{t("app.tagline")}</h1>
          <form action="/schemes" method="get" role="search" className="flex gap-2 max-w-xl">
            <label htmlFor="home-q" className="sr-only">{t("search.placeholder")}</label>
            <input id="home-q" name="q" className="input" placeholder={t("search.placeholder")} />
            <button className="btn btn-primary">{t("search.button")}</button>
          </form>
          <ul className="flex flex-wrap gap-2" aria-label={hi ? "त्वरित खोज" : "Quick searches"}>
            {quick.map(([q, l]) => (
              <li key={q}><Link className="btn btn-sm" href={`/schemes?q=${q}`}>{l}</Link></li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/dashboard" className="btn btn-accent">{t("home.cta.check")}</Link>
            <Link href="/schemes" className="btn btn-primary">{t("home.cta.browse")}</Link>
          </div>
          <p className="text-sm text-ink-2">{hi ? `${schemes} योजनाएँ और ${scholarships} छात्रवृत्तियाँ, प्रत्येक के आधिकारिक स्रोत के साथ।` : `${schemes} schemes and ${scholarships} scholarships, each with its official source.`}</p>
        </div>
        <aside className="card p-5 border-t-4 border-t-accent" aria-labelledby="how-h">
          <h2 id="how-h" className="font-bold text-lg mb-2">{t("home.how.title")}</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>{t("home.how.1")}</li>
            <li>{t("home.how.2")}</li>
            <li>{t("home.how.3")}</li>
          </ol>
        </aside>
      </section>
    </div>
  );
}
