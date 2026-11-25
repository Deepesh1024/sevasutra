import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getSession, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { CONSENTS } from "@/lib/consent";
import { maskPhone } from "@/lib/redact";
import { Pill, fmtDate, pickL } from "@/components/ui";
import { deleteAccountAction, revokeOtherSessionsAction, revokeSessionAction, savePrefsAction, setEmailAction } from "@/app/actions/account";
import { withdrawConsentAction } from "@/app/actions/profile";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const s = await getSession();
  const { lang } = await getT();
  const hi = lang === "hi";
  const [identities, consents, sessions] = await Promise.all([
    db.identity.findMany({ where: { userId: user.id } }),
    db.consent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
  ]);
  const prefs = (user.notificationPrefs as Record<string, boolean>) ?? {};
  const active = CONSENTS.filter((c) => consents.some((x) => x.purpose === c.purpose && x.granted && !x.withdrawnAt));

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{hi ? "खाता" : "Account"}</h1>

      <section className="card p-4 space-y-2" aria-labelledby="id-h">
        <h2 id="id-h" className="font-bold text-lg">{hi ? "पहचान" : "Identity"}</h2>
        <p>{hi ? "भूमिका" : "Role"}: <Pill tone="primary">{user.role}</Pill></p>
        <p>{hi ? "मोबाइल" : "Mobile"}: {user.phoneE164 ? `${maskPhone(user.phoneE164)} ✓` : <Link href="/login/verify-phone?next=/account">{hi ? "सत्यापित करें" : "Verify to become an applicant"}</Link>}</p>
        <p>{hi ? "जुड़े साइन-इन" : "Linked sign-ins"}: {identities.map((i) => i.provider).join(", ")}</p>
      </section>

      <section id="notifications" className="card p-4 space-y-3" aria-labelledby="n-h">
        <h2 id="n-h" className="font-bold text-lg">{hi ? "ईमेल रिमाइंडर" : "Email reminders"}</h2>
        {sp.sent && <p role="status" className="text-ok">{hi ? "पुष्टि ईमेल भेजा गया।" : "Confirmation email sent."} {process.env.NODE_ENV !== "production" && !process.env.SMTP_URL && <Link href="/dev/mailbox">Open dev mailbox</Link>}</p>}
        {sp.verified && <p role="status" className="text-ok">{hi ? "ईमेल सत्यापित।" : "Email verified."}</p>}
        {sp.error && <p role="alert" className="text-bad">{sp.error === "email" ? "Enter a valid email." : sp.error === "rate" ? "Too many attempts." : "That link is invalid or expired."}</p>}
        <form action={setEmailAction} className="flex flex-wrap gap-2 items-end">
          <div className="field"><label htmlFor="em">Email</label><input id="em" name="email" type="email" defaultValue={user.email ?? ""} required /></div>
          <button className="btn">{user.email ? (hi ? "बदलें और सत्यापित करें" : "Change & verify") : hi ? "जोड़ें और सत्यापित करें" : "Add & verify"}</button>
          {user.email && (user.emailVerifiedAt ? <Pill tone="ok">{hi ? "सत्यापित" : "verified"}</Pill> : <Pill tone="warn">{hi ? "असत्यापित" : "not verified"}</Pill>)}
        </form>
        <form action={savePrefsAction} className="space-y-1">
          {([
            ["email", hi ? "मुझे ईमेल रिमाइंडर भेजें (ऑप्ट-इन)" : "Send me email reminders (opt-in)"],
            ["deadlines", hi ? "अंतिम तिथि और नवीनीकरण" : "Deadlines and renewals"],
            ["documents", hi ? "छूटे दस्तावेज़" : "Missing documents"],
            ["profile", hi ? "प्रोफ़ाइल पूरी करना" : "Profile completion"],
            ["status", hi ? "आवेदन स्थिति" : "Application status"],
            ["corrections", hi ? "पुराने परिणाम को प्रभावित करने वाले सुधार" : "Corrections that change an earlier result"],
          ] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 min-h-[36px]"><input type="checkbox" name={k} defaultChecked={k === "email" ? !!prefs.email : prefs[k] !== false} className="w-5 h-5" disabled={k === "email" && !user.emailVerifiedAt} />{l}</label>
          ))}
          <p className="help">{hi ? "रिमाइंडर रात 9 बजे से सुबह 8 बजे (IST) के बीच नहीं भेजे जाते। विषय में कभी संवेदनशील जानकारी नहीं होती।" : "No reminders between 9 pm and 8 am IST. Subjects never contain sensitive details. SMS/WhatsApp are not enabled."}</p>
          <button className="btn btn-primary">{hi ? "प्राथमिकताएँ सहेजें" : "Save preferences"}</button>
          {sp.saved === "prefs" && <span role="status" className="text-ok ml-2">✓</span>}
        </form>
      </section>

      <section className="card p-4 space-y-2" aria-labelledby="c-h">
        <h2 id="c-h" className="font-bold text-lg">{hi ? "सहमतियाँ" : "Consents"}</h2>
        {active.length === 0 ? <p className="text-ink-2">{hi ? "कोई सक्रिय सहमति नहीं।" : "No active consents."}</p> : (
          <ul className="divide-y divide-line">
            {active.map((c) => (
              <li key={c.purpose} className="py-2 flex flex-wrap justify-between items-center gap-2">
                <span>{pickL(c.title, lang)}</span>
                <form action={withdrawConsentAction}><input type="hidden" name="purpose" value={c.purpose} /><button className="btn btn-sm btn-danger">{hi ? "वापस लें" : "Withdraw"}</button></form>
              </li>
            ))}
          </ul>
        )}
        <Link href="/consent?next=/account" className="btn btn-sm">{hi ? "सहमतियाँ प्रबंधित करें" : "Review notices / give consent"}</Link>
      </section>

      <section className="card p-4 space-y-2" aria-labelledby="s-h">
        <h2 id="s-h" className="font-bold text-lg">{hi ? "डिवाइस और सत्र" : "Devices and sessions"}</h2>
        <ul className="divide-y divide-line text-sm">
          {sessions.map((x) => (
            <li key={x.id} className="py-2 flex flex-wrap justify-between gap-2 items-center">
              <span>{x.userAgent?.slice(0, 80) ?? "Unknown device"} · {hi ? "अंतिम उपयोग" : "last active"} {fmtDate(x.lastSeenAt, lang)} {x.id === s?.id && <Pill tone="ok">{hi ? "यह डिवाइस" : "this device"}</Pill>}</span>
              {x.id !== s?.id && <form action={revokeSessionAction}><input type="hidden" name="sessionId" value={x.id} /><button className="btn btn-sm">{hi ? "साइन आउट" : "Sign out"}</button></form>}
            </li>
          ))}
        </ul>
        <form action={revokeOtherSessionsAction}><button className="btn btn-sm">{hi ? "अन्य सभी डिवाइस से साइन आउट" : "Sign out all other devices"}</button></form>
      </section>

      <section className="card p-4 space-y-2" aria-labelledby="d-h">
        <h2 id="d-h" className="font-bold text-lg">{hi ? "आपका डेटा" : "Your data"}</h2>
        <p className="text-sm">{hi ? "अपनी प्रोफ़ाइल प्रोफ़ाइल पृष्ठ पर देखें और सुधारें।" : "View and correct your answers on the"} <Link href="/profile">{hi ? "प्रोफ़ाइल" : "Profile page"}</Link>.</p>
        <a href="/api/account/export" className="btn btn-sm">{hi ? "मेरा डेटा निर्यात करें (JSON)" : "Export my data (JSON)"}</a>
      </section>

      <section id="delete" className="card p-4 space-y-2 border-bad" aria-labelledby="del-h">
        <h2 id="del-h" className="font-bold text-lg text-bad">{hi ? "खाता हटाएँ" : "Delete account"}</h2>
        <p className="text-sm">{hi ? "आपकी प्रोफ़ाइल, दस्तावेज़ (फ़ाइलें सहित), आवेदन ट्रैकर, सहेजी गई योजनाएँ और सत्र स्थायी रूप से हटा दिए जाएँगे। ऑडिट लॉग में केवल यह दर्ज रहेगा कि खाता हटाया गया। यह पूर्ववत नहीं किया जा सकता।" : "Your profile, documents (including files), application trackers, saved schemes and sessions will be permanently deleted. The audit log keeps only a record that the account was deleted. This cannot be undone."}</p>
        {sp.error === "confirm" && <p role="alert" className="text-bad">Type DELETE to confirm.</p>}
        <form action={deleteAccountAction} className="flex flex-wrap gap-2 items-end">
          <div className="field"><label htmlFor="cf">{hi ? "पुष्टि के लिए DELETE लिखें" : "Type DELETE to confirm"}</label><input id="cf" name="confirm" autoComplete="off" /></div>
          <button className="btn btn-danger">{hi ? "स्थायी रूप से हटाएँ" : "Delete permanently"}</button>
        </form>
      </section>
    </div>
  );
}
