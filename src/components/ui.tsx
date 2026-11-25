import type { EligibilityStatus, Localized } from "@/lib/engine/types";
import { translate, type Lang } from "@/lib/i18n/dict";

export const pickL = (l: Localized | undefined, lang: Lang) => (l ? (lang === "hi" ? l.hi ?? l.en : l.en) : "");

const STATUS_STYLE: Record<EligibilityStatus, { cls: string; icon: string }> = {
  eligible: { cls: "text-ok bg-ok-soft", icon: "✓" },
  partially_eligible: { cls: "text-warn bg-warn-soft", icon: "◐" },
  not_eligible: { cls: "text-bad bg-bad-soft", icon: "✕" },
  expired_or_closed: { cls: "text-muted bg-muted-soft", icon: "⏸" },
  needs_manual_review: { cls: "text-review bg-review-soft", icon: "?" },
};

export function StatusBadge({ status, lang }: { status: EligibilityStatus; lang: Lang }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`badge ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {translate(lang, `status.${status}` as never)}
    </span>
  );
}

export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "warn" | "bad" | "ok" | "review" }) {
  const cls = { muted: "text-muted bg-muted-soft", primary: "text-primary bg-primary-soft", warn: "text-warn bg-warn-soft", bad: "text-bad bg-bad-soft", ok: "text-ok bg-ok-soft", review: "text-review bg-review-soft" }[tone];
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function fmtDate(d: Date | string | null | undefined, lang: Lang = "en") {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span aria-hidden> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export const LEVEL_LABEL: Record<string, Localized> = {
  central: { en: "Central", hi: "केंद्र" },
  state: { en: "State", hi: "राज्य" },
  UT: { en: "Union Territory", hi: "केंद्र शासित प्रदेश" },
  local: { en: "Local body", hi: "स्थानीय निकाय" },
  joint: { en: "Centre + State", hi: "केंद्र + राज्य" },
};

export const CATEGORY_LABEL: Record<string, Localized> = {
  agriculture: { en: "Agriculture", hi: "कृषि" },
  banking: { en: "Banking", hi: "बैंकिंग" },
  insurance: { en: "Insurance", hi: "बीमा" },
  health: { en: "Health", hi: "स्वास्थ्य" },
  housing: { en: "Housing", hi: "आवास" },
  energy: { en: "Energy / LPG", hi: "ऊर्जा / एलपीजी" },
  women_child: { en: "Women & children", hi: "महिला एवं बाल" },
  social_security: { en: "Social security", hi: "सामाजिक सुरक्षा" },
  education: { en: "Education", hi: "शिक्षा" },
  business: { en: "Business & livelihood", hi: "व्यवसाय एवं आजीविका" },
  pension: { en: "Pension", hi: "पेंशन" },
};

export const BENEFIT_LABEL: Record<string, Localized> = {
  cash: { en: "Cash (DBT)", hi: "नकद (डीबीटी)" },
  reimbursement: { en: "Reimbursement", hi: "प्रतिपूर्ति" },
  subsidy: { en: "Subsidy", hi: "सब्सिडी" },
  service: { en: "Service", hi: "सेवा" },
  insurance: { en: "Insurance", hi: "बीमा" },
  loan: { en: "Loan / credit", hi: "ऋण" },
  fee_waiver: { en: "Fee waiver", hi: "शुल्क माफ़ी" },
  non_cash: { en: "Non-cash support", hi: "गैर-नकद सहायता" },
  savings: { en: "Savings product", hi: "बचत उत्पाद" },
  pension: { en: "Pension", hi: "पेंशन" },
};

export const MODE_LABEL: Record<string, Localized> = {
  official_portal: { en: "Official portal", hi: "आधिकारिक पोर्टल" },
  official_url: { en: "Provider website", hi: "प्रदाता वेबसाइट" },
  authorised_api: { en: "Through SevaSutra (authorised API)", hi: "सेवासूत्र के माध्यम से (अधिकृत API)" },
  csc_offline: { en: "Common Service Centre / offline", hi: "कॉमन सर्विस सेंटर / ऑफ़लाइन" },
  department_office: { en: "Bank / department office", hi: "बैंक / विभाग कार्यालय" },
  unavailable: { en: "Not accepting applications", hi: "आवेदन स्वीकार नहीं" },
};

export const SCHOLARSHIP_LABEL: Record<string, Localized> = {
  central: { en: "Central government", hi: "केंद्र सरकार" },
  state: { en: "State government", hi: "राज्य सरकार" },
  university: { en: "University", hi: "विश्वविद्यालय" },
  corporate_csr: { en: "Corporate / CSR (non-government)", hi: "कॉर्पोरेट / CSR (गैर-सरकारी)" },
  fellowship: { en: "Fellowship", hi: "फ़ेलोशिप" },
};

export const TARGET_LABEL = (t: string): Localized => ({ en: t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
