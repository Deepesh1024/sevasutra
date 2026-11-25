import Link from "next/link";
import type { SchemeVersion } from "@prisma/client";
import type { EligibilityStatus } from "@/lib/engine/types";
import type { SchemeContent } from "@/lib/schemes/types";
import type { Lang } from "@/lib/i18n/dict";
import { translate } from "@/lib/i18n/dict";
import { BENEFIT_LABEL, LEVEL_LABEL, Pill, StatusBadge, fmtDate, pickL } from "./ui";

export function SchemeCard({ v, lang, status, extra }: { v: SchemeVersion; lang: Lang; status?: EligibilityStatus; extra?: React.ReactNode }) {
  const c = v.content as unknown as SchemeContent;
  return (
    <article className="card p-4 flex flex-col gap-2 h-full">
      <div className="flex flex-wrap gap-1.5 items-center">
        <Pill tone="primary">{pickL(LEVEL_LABEL[c.level], lang)}{c.stateScope.length ? ` · ${c.stateScope.join(", ")}` : ""}</Pill>
        {c.kind === "scholarship" && <Pill>{lang === "hi" ? "छात्रवृत्ति" : "Scholarship"}</Pill>}
        {c.isThirdParty && <Pill tone="warn">{lang === "hi" ? "गैर-सरकारी" : "Non-government"}</Pill>}
        {status && <StatusBadge status={status} lang={lang} />}
      </div>
      <h3 className="font-bold text-lg leading-snug">
        <Link href={`/schemes/${v.schemeId}`} className="text-ink">{pickL(c.name, lang)}</Link>
      </h3>
      <p className="text-sm text-ink-2">{c.ministry}</p>
      <p className="text-[0.95rem] flex-1">{pickL(c.summary, lang)}</p>
      <div className="flex flex-wrap gap-2 text-sm text-ink-2">
        <span>{pickL(BENEFIT_LABEL[c.benefit.kind], lang)}</span>
        <span aria-hidden>·</span>
        <span>{translate(lang, "scheme.deadline")}: {v.deadline ? fmtDate(v.deadline, lang) : v.lifecycleStatus === "closed" ? translate(lang, "status.expired_or_closed") : "—"}</span>
      </div>
      {extra}
    </article>
  );
}
