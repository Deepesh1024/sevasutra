import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { evaluate, hashRule, type SchemeForEvaluation } from "@/lib/engine/evaluate";
import { ageOn, resolveFact } from "@/lib/engine/facts";
import type { FactInput, RuleDefinition, RuleNode } from "@/lib/engine/types";

const NOW = new Date("2026-07-15T00:00:00Z");
const leaf = (id: string, fact: string, op: string, value?: unknown): RuleNode =>
  ({ id, fact, op, ...(value === undefined ? {} : { value }), label: { en: id } }) as RuleNode;

function scheme(mandatory: RuleNode, extra: Partial<RuleDefinition> = {}, s: Partial<SchemeForEvaluation> = {}): SchemeForEvaluation {
  return { id: "t", lifecycleStatus: "open", rule: { schemaVersion: 1, mandatory, ...extra }, documents: [], ...s };
}
const facts = (o: Record<string, unknown>): FactInput =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [{ key: k, value: v as never, provenance: "user_entered" as const }]]));

describe("derived facts", () => {
  it("computes age on a reference date", () => {
    expect(ageOn(new Date("2000-07-15"), NOW)).toBe(26);
    expect(ageOn(new Date("2000-07-16"), NOW)).toBe(25);
  });
  it("uses an age band as an interval and returns unknown when it straddles the limit", () => {
    const s = scheme(leaf("a", "age", "gte", 18));
    expect(evaluate(s, facts({ age_band: "10-17" }), { now: NOW }).status).toBe("not_eligible");
    expect(evaluate(s, facts({ age_band: "26-40" }), { now: NOW }).status).toBe("eligible");
    expect(evaluate(scheme(leaf("a", "age", "gte", 21)), facts({ age_band: "18-25" }), { now: NOW }).status).toBe("partially_eligible");
  });
});

describe("statuses", () => {
  const s = scheme({ all: [leaf("inc", "annual_family_income", "lte", 250000), leaf("st", "is_student", "is_true")] });

  it("eligible when every mandatory condition passes", () => {
    expect(evaluate(s, facts({ annual_family_income: 100000, is_student: true }), { now: NOW }).status).toBe("eligible");
  });
  it("not_eligible when any mandatory condition fails, even if others are unknown", () => {
    expect(evaluate(s, facts({ annual_family_income: 300000 }), { now: NOW }).status).toBe("not_eligible");
  });
  it("partially_eligible when nothing fails but a fact is missing", () => {
    const r = evaluate(s, facts({ annual_family_income: 100000 }), { now: NOW });
    expect(r.status).toBe("partially_eligible");
    expect(r.whatWouldChange.some((w) => w.en.includes("Are you currently a student"))).toBe(true);
  });
  it("treats 'prefer not to say' as unknown, never as a fail", () => {
    expect(evaluate(s, facts({ annual_family_income: "prefer_not_to_say", is_student: true }), { now: NOW }).status).toBe("partially_eligible");
  });
  it("needs_manual_review on conflicting values", () => {
    const input: FactInput = {
      annual_family_income: [
        { key: "annual_family_income", value: 100000, provenance: "user_entered" },
        { key: "annual_family_income", value: 400000, provenance: "document_extracted" },
      ],
      is_student: [{ key: "is_student", value: true, provenance: "user_entered" }],
    };
    expect(evaluate(s, input, { now: NOW }).status).toBe("needs_manual_review");
  });
  it("government-verified values win over user-entered ones", () => {
    const r = resolveFact(
      [
        { key: "x", value: 100000, provenance: "user_entered" },
        { key: "x", value: 400000, provenance: "government_verified" },
      ],
      NOW,
    );
    expect(r).toMatchObject({ state: "known", value: 400000, verified: true });
  });
  it("ignores expired fact records", () => {
    const r = resolveFact([{ key: "x", value: 1, provenance: "document_extracted", expiresAt: "2026-01-01" }], NOW);
    expect(r.state).toBe("missing");
  });
  it("expired_or_closed after the deadline, but still explains criteria", () => {
    const r = evaluate({ ...s, deadline: "2026-07-01" }, facts({ annual_family_income: 100000, is_student: true }), { now: NOW });
    expect(r.status).toBe("expired_or_closed");
    expect(r.leaves.every((l) => l.outcome === "pass")).toBe(true);
  });
  it("expired_or_closed for discontinued schemes", () => {
    expect(evaluate({ ...s, lifecycleStatus: "closed" }, facts({}), { now: NOW }).status).toBe("expired_or_closed");
  });
  it("needs_manual_review when the curator marks a rule ambiguous", () => {
    const r = evaluate(scheme(leaf("a", "is_student", "is_true"), { ambiguous: { note: { en: "Guideline unclear" } } }), facts({ is_student: true }), { now: NOW });
    expect(r.status).toBe("needs_manual_review");
    expect(r.manualReviewReason?.en).toBe("Guideline unclear");
  });
  it("partially_eligible when a fact requires verification but is only user-entered", () => {
    const sv = scheme({ id: "d", fact: "disability_percent", op: "gte", value: 40, requireVerified: true, label: { en: "40%+" } } as RuleNode);
    expect(evaluate(sv, facts({ disability_percent: 60 }), { now: NOW }).status).toBe("partially_eligible");
    const verified: FactInput = { disability_percent: [{ key: "disability_percent", value: 60, provenance: "government_verified" }] };
    expect(evaluate(sv, verified, { now: NOW }).status).toBe("eligible");
  });
});

describe("boolean structure", () => {
  it("any: passes on one true branch; unknown beats false", () => {
    const s = scheme({ any: [leaf("a", "x", "is_true"), leaf("b", "y", "is_true")] });
    expect(evaluate(s, facts({ x: false, y: true }), { now: NOW }).status).toBe("eligible");
    expect(evaluate(s, facts({ x: false }), { now: NOW }).status).toBe("partially_eligible");
    expect(evaluate(s, facts({ x: false, y: false }), { now: NOW }).status).toBe("not_eligible");
  });
  it("not: exclusions read correctly to the user", () => {
    const s = scheme({ all: [{ not: leaf("tax", "pays_income_tax", "is_true") }] });
    const ok = evaluate(s, facts({ pays_income_tax: false }), { now: NOW });
    expect(ok.status).toBe("eligible");
    expect(ok.leaves[0].outcome).toBe("pass");
    expect(ok.leaves[0].explanation.en).toMatch(/^Exclusion does not apply/);
    const bad = evaluate(s, facts({ pays_income_tax: true }), { now: NOW });
    expect(bad.status).toBe("not_eligible");
    expect(bad.leaves[0].outcome).toBe("fail");
    expect(bad.leaves[0].explanation.en).toMatch(/^Excluded/);
  });
  it("exceptions apply in priority order", () => {
    const s = scheme(leaf("a", "x", "is_true"), {
      exceptions: [
        { id: "late", priority: 2, when: leaf("e2", "y", "is_true"), effect: "not_eligible", explanation: { en: "2" } },
        { id: "first", priority: 1, when: leaf("e1", "y", "is_true"), effect: "needs_manual_review", explanation: { en: "1" } },
      ],
    });
    const r = evaluate(s, facts({ x: true, y: true }), { now: NOW });
    expect(r.status).toBe("needs_manual_review");
    expect(r.exceptionApplied?.id).toBe("first");
  });
  it("state-scoped schemes fail for residents of other states", () => {
    const s = scheme(leaf("a", "x", "is_true"), {}, { stateScope: ["MH"] });
    expect(evaluate(s, facts({ x: true, state: "KA" }), { now: NOW }).status).toBe("not_eligible");
    expect(evaluate(s, facts({ x: true, state: "MH" }), { now: NOW }).status).toBe("eligible");
    expect(evaluate(s, facts({ x: true }), { now: NOW }).status).toBe("partially_eligible");
  });
});

describe("benefit estimation", () => {
  it("picks a tier and annualises monthly amounts, and never counts loans as money", () => {
    const s = scheme(leaf("a", "x", "is_true"), {}, {
      benefit: {
        kind: "pension", amountMin: 200, amountMax: 500, frequency: "monthly", stated: true, countsAsMoney: true, basis: { en: "basis" },
        tiers: [{ id: "80", when: leaf("t", "age", "gte", 80), amount: 500, label: { en: "80+" } }, { id: "60", when: leaf("t2", "age", "gte", 60), amount: 200, label: { en: "60+" } }],
      },
    });
    const r = evaluate(s, facts({ x: true, date_of_birth: "1950-01-01" }), { now: NOW });
    expect(r.benefit?.amount).toBe(200);
    expect(r.benefit?.annualised).toBe(2400);
    const loan = evaluate(scheme(leaf("a", "x", "is_true"), {}, { benefit: { kind: "loan", amountMax: 50000, stated: false, countsAsMoney: false, basis: { en: "b" } } }), facts({ x: true }), { now: NOW });
    expect(loan.benefit?.annualised).toBeUndefined();
  });
});

describe("properties", () => {
  const rule: RuleNode = {
    all: [
      leaf("inc", "annual_family_income", "lte", 300000),
      { any: [leaf("g", "gender", "eq", "female"), leaf("c", "social_category", "in", ["sc", "st"])] },
      { not: leaf("t", "pays_income_tax", "is_true") },
    ],
  };
  const s = scheme(rule);
  const profile = fc.record(
    {
      annual_family_income: fc.oneof(fc.integer({ min: 0, max: 2_000_000 }), fc.constant("prefer_not_to_say")),
      gender: fc.constantFrom("female", "male", "transgender", "prefer_not_to_say"),
      social_category: fc.constantFrom("general", "obc", "sc", "st", "prefer_not_to_say"),
      pays_income_tax: fc.boolean(),
    },
    { requiredKeys: [] },
  );

  it("is deterministic: the same input always gives the same result", () => {
    fc.assert(fc.property(profile, (p) => JSON.stringify(evaluate(s, facts(p), { now: NOW })) === JSON.stringify(evaluate(s, facts(p), { now: NOW }))));
  });
  it("adding information never turns not_eligible into eligible unless the added fact is one that was unknown", () => {
    fc.assert(
      fc.property(profile, (p) => {
        const r = evaluate(s, facts(p), { now: NOW });
        if (r.status !== "not_eligible") return true;
        // A failing known fact stays failing whatever else we add.
        const full = { annual_family_income: 1, gender: "female", social_category: "sc", pays_income_tax: false, ...p };
        return evaluate(s, facts(full), { now: NOW }).status === "not_eligible";
      }),
    );
  });
  it("every failed or unknown decisive condition produces a 'what would change' hint", () => {
    fc.assert(
      fc.property(profile, (p) => {
        const r = evaluate(s, facts(p), { now: NOW });
        if (r.status === "eligible") return true;
        return r.whatWouldChange.length > 0;
      }),
    );
  });
  it("income monotonicity: lowering income never makes an applicant less eligible", () => {
    const rank = { not_eligible: 0, partially_eligible: 1, needs_manual_review: 1, eligible: 2, expired_or_closed: -1 } as const;
    fc.assert(
      fc.property(profile, fc.integer({ min: 0, max: 2_000_000 }), fc.integer({ min: 0, max: 2_000_000 }), (p, a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const rl = evaluate(s, facts({ ...p, annual_family_income: lo }), { now: NOW }).status;
        const rh = evaluate(s, facts({ ...p, annual_family_income: hi }), { now: NOW }).status;
        return rank[rl] >= rank[rh];
      }),
    );
  });
  it("rule hash is stable across key order", () => {
    expect(hashRule({ a: 1, b: { c: 2, d: 3 } })).toBe(hashRule({ b: { d: 3, c: 2 }, a: 1 }));
  });
});
