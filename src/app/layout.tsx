import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import "./globals.css";
import { getT } from "@/lib/i18n/server";
import { currentUser, isStaff } from "@/lib/auth/session";
import { setLang, togglePref } from "./actions/prefs";
import { logout } from "./actions/auth";
import { Ticker, type TickerItem } from "@/components/Ticker";
import { listPublished, contentOf } from "@/lib/schemes/repo";

const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-noto-deva", weight: ["400", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "SevaSutra — scheme eligibility assistant", template: "%s · SevaSutra" },
  description: "Find Indian government schemes and scholarships you may be eligible for, with transparent rules and official sources.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getT();
  const c = await cookies();
  const user = await currentUser();
  const contrast = c.get("sh_contrast")?.value === "high" ? "high" : undefined;
  const text = c.get("sh_text")?.value === "lg" ? "lg" : undefined;

  const hi = lang === "hi";
  const firstSentence = (x: string) => x.split(/(?<=[.।])\s/)[0];
  const tickerItems: TickerItem[] = (await listPublished()).map((v) => {
    const c = contentOf(v);
    const name = hi ? c.name.hi ?? c.name.en : c.name.en;
    const summary = hi ? c.summary.hi ?? c.summary.en : c.summary.en;
    const tag = c.lifecycleStatus !== "open" ? (hi ? "बंद" : "Closed") : c.isThirdParty ? (hi ? "गैर-सरकारी" : "Non-govt") : c.kind === "scholarship" ? (hi ? "छात्रवृत्ति" : "Scholarship") : c.stateScope.length ? c.stateScope.join(", ") : undefined;
    return { href: `/schemes/${v.schemeId}`, text: `${name} — ${firstSentence(summary)}`, tag };
  });

  const nav: [string, string][] = [
    ["/schemes", t("nav.schemes")],
    ["/dashboard", t("nav.dashboard")],
    ["/profile", t("nav.profile")],
    ["/documents", t("nav.documents")],
    ["/chat", t("nav.chat")],
  ];

  return (
    <html lang={lang} data-contrast={contrast} data-text={text} className={`${noto.variable} ${notoDeva.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">{t("nav.skip")}</a>
        <header className="bg-surface border-b border-line">
          <div aria-hidden className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, var(--primary) 0 50%, var(--accent) 50% 100%)" }} />
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="flex items-center gap-2.5 no-underline hover:no-underline" aria-label={`${t("app.name")} home`}>
              <span aria-hidden className="inline-grid place-items-center w-10 h-10 rounded-lg bg-primary text-primary-ink text-lg font-bold shadow-sm">से</span>
              <span className="leading-tight">
                <span className="block text-xl font-bold"><span className="text-primary">Seva</span><span className="text-accent">Sutra</span></span>
                <span className="block text-[0.72rem] text-ink-2">{hi ? "स्वतंत्र योजना सहायक · सरकारी वेबसाइट नहीं" : "Independent scheme assistant · not a government website"}</span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm ml-auto">
              <form action={setLang} className="flex items-center gap-1" aria-label={t("a11y.language")}>
                <button name="lang" value="en" className={`btn btn-sm ${lang === "en" ? "btn-primary" : ""}`} aria-pressed={lang === "en"} lang="en">English</button>
                <button name="lang" value="hi" className={`btn btn-sm ${lang === "hi" ? "btn-primary" : ""}`} aria-pressed={lang === "hi"} lang="hi">हिन्दी</button>
              </form>
              <form action={togglePref} className="flex items-center gap-1">
                <button name="pref" value="contrast" className="btn btn-sm" aria-pressed={!!contrast}>{t("a11y.contrast")}</button>
                <button name="pref" value="text" className="btn btn-sm" aria-pressed={!!text}>{t("a11y.textSize")}</button>
              </form>
              {user ? (
                <>
                  <Link href="/account" className="btn btn-sm">{t("nav.account")}</Link>
                  <form action={logout}><button className="btn btn-sm">{t("nav.logout")}</button></form>
                </>
              ) : (
                <Link href="/login" className="btn btn-sm btn-accent">{t("nav.login")}</Link>
              )}
            </div>
          </div>
          <nav aria-label="Main" className="bg-primary">
            <ul className="mx-auto max-w-6xl px-4 flex flex-wrap text-[0.95rem]">
              <li><Link href="/" className="block px-3 py-2.5 text-white font-semibold no-underline hover:bg-white/15 hover:no-underline">{hi ? "होम" : "Home"}</Link></li>
              {nav.map(([href, label]) => (
                <li key={href}><Link href={href} className="block px-3 py-2.5 text-white font-semibold no-underline hover:bg-white/15 hover:no-underline">{label}</Link></li>
              ))}
              {isStaff(user) && <li><Link href="/admin" className="block px-3 py-2.5 text-white font-semibold no-underline hover:bg-white/15 hover:no-underline">{t("nav.admin")}</Link></li>}
            </ul>
          </nav>
        </header>
        <Ticker items={tickerItems} label={hi ? "योजना अपडेट" : "Scheme updates"} pauseLabel={hi ? "रोकें" : "Pause"} playLabel={hi ? "चलाएँ" : "Play"} />
        <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        <footer className="border-t-4 border-accent bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-ink-2 flex flex-wrap gap-x-6 gap-y-2 justify-between">
            <p className="max-w-2xl">{t("footer.disclaimer")}</p>
            <ul className="flex gap-4">
              <li><Link href="/privacy">{t("footer.privacy")}</Link></li>
              <li><Link href="/sources">{t("footer.sources")}</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
