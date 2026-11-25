import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { activeFacts, getProfiles, hasConsent } from "@/lib/profile/service";
import { FIELDS, SECTIONS } from "@/lib/profile/fields";
import { FieldInput } from "@/components/FieldInput";
import { Pill, pickL, fmtDate } from "@/components/ui";
import { addMemberAction, deleteAnswerAction, removeMemberAction, saveProfileAction } from "@/app/actions/profile";
import type { FactValue } from "@/lib/engine/types";
import { isApplicant } from "@/lib/auth/roles";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ profile?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/profile");
  if (!(await hasConsent(user.id, "profile_basic"))) redirect("/consent?next=/profile");
  const { t, lang } = await getT();
  const hi = lang === "hi";
  const profiles = await getProfiles(user.id);
  const profile = profiles.find((p) => p.id === sp.profile) ?? profiles[0];
  const facts = await activeFacts(profile.id);
  const sensitiveOk = await hasConsent(user.id, "profile_sensitive");
  const verified = isApplicant(user);
  const valueOf = (k: string): FactValue | undefined => facts.filter((f) => f.key === k && f.provenance === "user_entered").at(-1)?.value as FactValue | undefined;
  const otherProvenance = (k: string) => facts.filter((f) => f.key === k && f.provenance !== "user_entered");

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-4">
        <nav aria-label={hi ? "प्रोफ़ाइल अनुभाग" : "Profile sections"} className="card p-3 lg:sticky lg:top-4">
          <ul className="space-y-1 text-sm">{SECTIONS.map((s) => <li key={s.key}><a href={`#sec-${s.key}`}>{pickL(s.label, lang)}</a></li>)}<li><a href="#members">{t("profile.members")}</a></li></ul>
        </nav>
      </aside>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{t("profile.title")}: {profile.label}</h1>
          {profiles.length > 1 && (
            <form method="get" className="flex gap-2 items-end">
              <div className="field"><label htmlFor="pp">{hi ? "सदस्य" : "Member"}</label><select id="pp" name="profile" defaultValue={profile.id}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
              <button className="btn">{hi ? "खोलें" : "Open"}</button>
            </form>
          )}
          <p className="text-ink-2">{hi ? "केवल वही उत्तर दें जो आप देना चाहते हैं। योजना पृष्ठ आपको केवल आवश्यक प्रश्न दिखाते हैं।" : "Answer only what you want to. Scheme pages ask only the questions each scheme needs."}</p>
          {!verified && <p className="card p-3 bg-warn-soft">{t("profile.discoveryOnly")} <Link href="/login/verify-phone?next=/profile">{hi ? "अभी सत्यापित करें" : "Verify now"}</Link></p>}
          {!sensitiveOk && <p className="text-sm">{hi ? "संवेदनशील प्रश्न (श्रेणी, दिव्यांगता, मातृत्व) तभी सहेजे जाएँगे जब आप " : "Sensitive questions (category, disability, maternity) are saved only after you "}<Link href="/consent?next=/profile">{hi ? "सहमति दें" : "give consent"}</Link>.</p>}
        </header>

        {SECTIONS.map((s) => {
          const fields = FIELDS.filter((f) => f.section === s.key);
          return (
            <form key={s.key} id={`sec-${s.key}`} action={saveProfileAction} className="card p-4 space-y-3 scroll-mt-4">
              <input type="hidden" name="profileId" value={profile.id} />
              <input type="hidden" name="section" value={s.key} />
              <div className="flex justify-between items-baseline">
                <h2 className="font-bold text-lg">{pickL(s.label, lang)}</h2>
                {sp.saved === s.key && <span role="status" className="text-ok text-sm font-semibold">✓ {t("profile.saved")}</span>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((f) => {
                  const locked = (!verified && !f.discovery) || (f.sensitive && !sensitiveOk);
                  const others = otherProvenance(f.key);
                  return (
                    <div key={f.key} className="space-y-1">
                      <FieldInput field={f} value={valueOf(f.key)} lang={lang} disabled={locked} />
                      {f.household && !profile.isPrimary && <p className="help">{hi ? "परिवार-स्तरीय: मुख्य प्रोफ़ाइल पर सहेजा जाता है।" : "Household-level: saved on the primary profile."}</p>}
                      {others.map((o) => (
                        <p key={o.id} className="help"><Pill tone="ok">{t(`profile.provenance.${o.provenance}` as never)}</Pill> {JSON.stringify(o.value)} · {fmtDate(o.verifiedAt ?? o.collectedAt, lang)}{o.expiresAt ? ` · ${hi ? "समाप्ति" : "expires"} ${fmtDate(o.expiresAt, lang)}` : ""}</p>
                      ))}
                      {valueOf(f.key) !== undefined && (
                        <button formAction={deleteAnswerAction.bind(null, f.key)} className="text-sm text-bad underline" formNoValidate>{t("common.delete")} {hi ? "उत्तर" : "answer"}</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-primary">{t("profile.save")}</button>
            </form>
          );
        })}

        <section id="members" aria-labelledby="mem-h" className="card p-4 space-y-3 scroll-mt-4">
          <h2 id="mem-h" className="font-bold text-lg">{t("profile.members")}</h2>
          <ul className="divide-y divide-line">
            {profiles.map((p) => (
              <li key={p.id} className="py-2 flex flex-wrap justify-between items-center gap-2">
                <span><Link href={`/profile?profile=${p.id}`}>{p.label}</Link> <span className="text-ink-2 text-sm">({p.relationship}{p.guardianConsentAt ? (hi ? ", नाबालिग — अभिभावक सहमति" : ", minor — guardian consent") : ""})</span></span>
                {!p.isPrimary && <form action={removeMemberAction}><input type="hidden" name="profileId" value={p.id} /><button className="btn btn-sm btn-danger">{t("common.delete")}</button></form>}
              </li>
            ))}
          </ul>
          {sp.error === "guardian" && <p role="alert" className="text-bad">{hi ? "बच्चे के लिए अभिभावक सहमति आवश्यक है।" : "Guardian consent is required to add a child."}</p>}
          {verified ? (
            <form action={addMemberAction} className="grid gap-3 md:grid-cols-2 border-t border-line pt-3">
              <div className="field"><label htmlFor="m-label">{hi ? "नाम या लेबल" : "Name or label"}</label><input id="m-label" name="label" maxLength={40} required placeholder={hi ? "जैसे बेटी" : "e.g. Daughter"} /></div>
              <div className="field"><label htmlFor="m-rel">{hi ? "संबंध" : "Relationship"}</label>
                <select id="m-rel" name="relationship"><option value="spouse">{hi ? "पति/पत्नी" : "Spouse"}</option><option value="child">{hi ? "संतान" : "Child"}</option><option value="parent">{hi ? "माता/पिता" : "Parent"}</option><option value="sibling">{hi ? "भाई/बहन" : "Sibling"}</option><option value="other">{hi ? "अन्य" : "Other"}</option></select>
              </div>
              <label className="flex gap-2 items-start"><input type="checkbox" name="minor" className="mt-1 w-5 h-5" /><span>{hi ? "यह सदस्य 18 वर्ष से कम है" : "This member is under 18"}</span></label>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" name="guardian_consent" className="mt-1 w-5 h-5" /><span>{hi ? "मैं माता-पिता/अभिभावक हूँ और इस बच्चे की जानकारी केवल पात्रता जाँच हेतु दर्ज करने की सहमति देता/देती हूँ।" : "I am the parent/guardian and consent to entering this child's details only to check eligibility."}</span></label>
              <button className="btn md:col-span-2 justify-self-start">{t("profile.addMember")}</button>
            </form>
          ) : <p className="text-sm">{hi ? "परिवार के सदस्य जोड़ने के लिए मोबाइल सत्यापित करें।" : "Verify your mobile number to add family members."}</p>}
        </section>
      </div>
    </div>
  );
}
