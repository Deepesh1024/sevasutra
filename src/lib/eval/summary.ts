import type { EvaluationResult, Localized } from "@/lib/engine/types";

export interface SummaryItem {
  schemeId: string;
  name: Localized;
  result: EvaluationResult;
  unit?: "individual" | "household";
  memberLabel?: string;
  thirdParty?: boolean;
}

export interface BenefitSummary {
  statedAnnual: number;
  statedOneTime: number;
  estimatedAnnualMax: number;
  estimatedOneTimeMax: number;
  statedLines: { schemeId: string; name: Localized; annual?: number; oneTime?: number; basis: Localized; memberLabel?: string }[];
  estimatedLines: { schemeId: string; name: Localized; annual?: number; oneTime?: number; basis: Localized; group?: string; countedInTotal: boolean; memberLabel?: string }[];
  nonCash: { schemeId: string; name: Localized; basis: Localized; memberLabel?: string }[];
  /** Non-government (corporate/CSR) opportunities: shown separately, never added to totals. */
  thirdParty: { schemeId: string; name: Localized; amount?: number; basis: Localized; memberLabel?: string }[];
  notes: Localized[];
}

/**
 * Benefit summary for likely-eligible schemes only.
 * - "Stated" = fixed amounts in guidelines; "estimated" = ceilings/ranges — never mixed.
 * - Mutually exclusive schemes (same exclusivityGroup) contribute only their largest value.
 * - Household-level schemes are counted once per household.
 * - Insurance cover, loans, savings and services are listed but never added to money totals.
 */
export function summariseBenefits(items: SummaryItem[]): BenefitSummary {
  const out: BenefitSummary = { statedAnnual: 0, statedOneTime: 0, estimatedAnnualMax: 0, estimatedOneTimeMax: 0, statedLines: [], estimatedLines: [], nonCash: [], thirdParty: [], notes: [] };
  const seenHousehold = new Set<string>();
  const groupBest = new Map<string, { annual: number; oneTime: number; idx: number }>();

  for (const it of items) {
    if (it.result.status !== "eligible") continue;
    const b = it.result.benefit;
    if (!b) continue;
    if (it.unit === "household") {
      if (seenHousehold.has(it.schemeId)) continue;
      seenHousehold.add(it.schemeId);
    }
    if (it.thirdParty) {
      out.thirdParty.push({ schemeId: it.schemeId, name: it.name, amount: b.amount ?? b.amountMax, basis: b.basis, memberLabel: it.memberLabel });
      continue;
    }
    if (!b.countsAsMoney) {
      out.nonCash.push({ schemeId: it.schemeId, name: it.name, basis: b.basis, memberLabel: it.memberLabel });
      continue;
    }
    const value = b.amount ?? b.amountMax;
    if (value === undefined) {
      out.nonCash.push({ schemeId: it.schemeId, name: it.name, basis: b.basis, memberLabel: it.memberLabel });
      continue;
    }
    const recurring = b.annualised !== undefined;
    const annual = recurring ? b.annualised : undefined;
    const oneTime = recurring ? undefined : value;

    if (b.stated && !b.exclusivityGroup) {
      out.statedLines.push({ schemeId: it.schemeId, name: it.name, annual, oneTime, basis: b.basis, memberLabel: it.memberLabel });
      out.statedAnnual += annual ?? 0;
      out.statedOneTime += oneTime ?? 0;
      continue;
    }
    // Estimates, and anything in an exclusivity group (only one can be received).
    const line = { schemeId: it.schemeId, name: it.name, annual, oneTime, basis: b.basis, group: b.exclusivityGroup, countedInTotal: true, memberLabel: it.memberLabel };
    const key = b.exclusivityGroup ? `${b.exclusivityGroup}:${it.memberLabel ?? ""}` : undefined;
    if (key) {
      const prev = groupBest.get(key);
      const score = (annual ?? 0) + (oneTime ?? 0);
      if (prev && prev.annual + prev.oneTime >= score) {
        line.countedInTotal = false;
      } else {
        if (prev) {
          out.estimatedLines[prev.idx].countedInTotal = false;
          out.estimatedAnnualMax -= prev.annual;
          out.estimatedOneTimeMax -= prev.oneTime;
        }
        groupBest.set(key, { annual: annual ?? 0, oneTime: oneTime ?? 0, idx: out.estimatedLines.length });
      }
    }
    out.estimatedLines.push(line);
    if (line.countedInTotal) {
      out.estimatedAnnualMax += annual ?? 0;
      out.estimatedOneTimeMax += oneTime ?? 0;
    }
  }
  if (out.estimatedLines.some((l) => !l.countedInTotal)) {
    out.notes.push({ en: "Some scholarships cannot be combined; only the largest in each group is counted.", hi: "कुछ छात्रवृत्तियाँ एक साथ नहीं मिलतीं; प्रत्येक समूह में केवल सबसे बड़ी गिनी गई है।" });
  }
  out.notes.push({ en: "Totals include only schemes you are likely eligible for. They are not a promise of payment.", hi: "कुल में केवल वे योजनाएँ शामिल हैं जिनके लिए आप संभवतः पात्र हैं। यह भुगतान का वादा नहीं है।" });
  return out;
}
