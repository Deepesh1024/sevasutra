import { describe, expect, it } from "vitest";
import { summariseBenefits, type SummaryItem } from "@/lib/eval/summary";
import type { BenefitEstimate, EvaluationResult } from "@/lib/engine/types";

const res = (status: EvaluationResult["status"], b: Partial<BenefitEstimate>): EvaluationResult =>
  ({ status, benefit: { kind: "cash", stated: true, countsAsMoney: true, basis: { en: "b" }, calculation: [], ...b } }) as EvaluationResult;
const item = (id: string, r: EvaluationResult, extra: Partial<SummaryItem> = {}): SummaryItem => ({ schemeId: id, name: { en: id }, result: r, ...extra });

describe("benefit summary", () => {
  it("separates stated amounts from estimates and ignores non-eligible schemes", () => {
    const s = summariseBenefits([
      item("kisan", res("eligible", { amount: 6000, annualised: 6000 })),
      item("pmay", res("eligible", { amountMax: 250000, stated: false })),
      item("other", res("partially_eligible", { amount: 9999, annualised: 9999 })),
    ]);
    expect(s.statedAnnual).toBe(6000);
    expect(s.estimatedOneTimeMax).toBe(250000);
    expect(s.statedLines.map((l) => l.schemeId)).toEqual(["kisan"]);
  });
  it("never adds loans or insurance to totals", () => {
    const s = summariseBenefits([item("loan", res("eligible", { kind: "loan", amountMax: 300000, countsAsMoney: false }))]);
    expect(s.statedAnnual + s.statedOneTime + s.estimatedAnnualMax + s.estimatedOneTimeMax).toBe(0);
    expect(s.nonCash).toHaveLength(1);
  });
  it("does not double-count mutually exclusive scholarships", () => {
    const s = summariseBenefits([
      item("a", res("eligible", { amount: 12000, annualised: 12000, exclusivityGroup: "post" })),
      item("b", res("eligible", { amountMax: 13500, annualised: 13500, stated: false, exclusivityGroup: "post" })),
    ]);
    expect(s.estimatedAnnualMax).toBe(13500);
    expect(s.estimatedLines.filter((l) => l.countedInTotal)).toHaveLength(1);
  });
  it("counts household schemes once even if several members qualify", () => {
    const r = res("eligible", { amount: 6000, annualised: 6000 });
    const s = summariseBenefits([item("kisan", r, { unit: "household", memberLabel: "Me" }), item("kisan", r, { unit: "household", memberLabel: "Spouse" })]);
    expect(s.statedAnnual).toBe(6000);
  });
});

describe("third-party opportunities", () => {
  it("are listed separately and never added to government benefit totals", () => {
    const s = summariseBenefits([item("rf", res("eligible", { amountMax: 200000, stated: false }), { thirdParty: true })]);
    expect(s.estimatedOneTimeMax).toBe(0);
    expect(s.thirdParty).toHaveLength(1);
  });
});
