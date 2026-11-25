// Rule regression harness: hand-written cases + generated boundary/edge cases.
// Used by Vitest (CI) and by the admin console before a version can be published.

import { evaluate, type SchemeForEvaluation } from "@/lib/engine/evaluate";
import type { FactInput, FactLeaf, FactRecord, FactValue, Provenance, RuleNode } from "@/lib/engine/types";
import type { SchemeContent, TestCaseSpec } from "./types";

export const TEST_NOW = "2026-07-15T00:00:00.000Z";

export function toEvaluable(c: SchemeContent, overrides: { deadline?: string } = {}, ruleMeta?: { effectiveFrom?: string; effectiveUntil?: string | null }): SchemeForEvaluation {
  return {
    id: c.schemeId,
    lifecycleStatus: c.lifecycleStatus,
    deadline: overrides.deadline ?? c.application.deadline ?? null,
    opensAt: c.application.opensAt ?? null,
    rule: c.rule,
    ruleEffectiveFrom: ruleMeta?.effectiveFrom ?? c.effectiveFrom,
    ruleEffectiveUntil: ruleMeta?.effectiveUntil ?? null,
    documents: c.documents,
    benefit: c.benefit,
    stateScope: c.stateScope,
  };
}

export function specToFacts(facts: TestCaseSpec["facts"]): FactInput {
  const out: FactInput = {};
  for (const [key, v] of Object.entries(facts)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && "provenance" in (v[0] as object)) {
      out[key] = (v as { value: FactValue; provenance: Provenance }[]).map((r) => ({ key, value: r.value, provenance: r.provenance }));
    } else {
      out[key] = [{ key, value: v as FactValue, provenance: "user_entered" }];
    }
  }
  return out;
}

function topLevelLeaves(node: RuleNode): FactLeaf[] {
  if ((node as FactLeaf).fact) return [node as FactLeaf];
  if ("all" in node) return node.all.flatMap(topLevelLeaves);
  return [];
}

function yearsAgo(now: Date, years: number): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Derive boundary, missing-document, conflict, deadline and state cases from the first `eligible` case. */
export function generateCases(c: SchemeContent, handWritten: TestCaseSpec[]): TestCaseSpec[] {
  const baseCase = handWritten.find((t) => t.kind === "eligible");
  if (!baseCase) return [];
  const out: TestCaseSpec[] = [];
  const closed = baseCase.expected === "expired_or_closed";
  const ok = baseCase.expected;
  const no = closed ? "expired_or_closed" : "not_eligible";
  const now = new Date(TEST_NOW);
  const leaves = topLevelLeaves(c.rule.mandatory);
  const facts = { ...baseCase.facts };
  if (c.stateScope.length > 0 && !facts.state) facts.state = c.stateScope[0];

  // The reference date for age may differ from "now" (e.g. academic_year_start); boundaries are computed on it.
  const refNow = c.rule.referenceDate === "academic_year_start" ? new Date(Date.UTC(now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, 3, 1)) : now;

  for (const leaf of leaves) {
    if (leaf.fact === "age" && typeof leaf.value === "number") {
      const n = leaf.value;
      const inside = leaf.op === "gte" || leaf.op === "lte" ? n : leaf.op === "gt" ? n + 1 : n - 1;
      const outside = leaf.op === "gte" ? n - 1 : leaf.op === "lte" ? n + 1 : leaf.op === "gt" ? n : n;
      out.push({ name: `Boundary: age exactly ${inside}`, kind: "boundary_age", facts: { ...facts, date_of_birth: yearsAgo(refNow, inside), age_band: null }, expected: ok, now: TEST_NOW });
      out.push({ name: `Boundary: age ${outside} (outside limit)`, kind: "boundary_age", facts: { ...facts, date_of_birth: yearsAgo(refNow, outside), age_band: null }, expected: no, now: TEST_NOW });
    }
    if (leaf.fact === "age" && leaf.op === "between" && Array.isArray(leaf.value)) {
      const [a, b] = leaf.value as [number, number];
      out.push({ name: `Boundary: age exactly ${a}`, kind: "boundary_age", facts: { ...facts, date_of_birth: yearsAgo(refNow, a) }, expected: ok, now: TEST_NOW });
      out.push({ name: `Boundary: age exactly ${b}`, kind: "boundary_age", facts: { ...facts, date_of_birth: yearsAgo(refNow, b) }, expected: ok, now: TEST_NOW });
      out.push({ name: `Boundary: age ${b + 1}`, kind: "boundary_age", facts: { ...facts, date_of_birth: yearsAgo(refNow, b + 1) }, expected: no, now: TEST_NOW });
    }
    if (leaf.fact === "annual_family_income" && typeof leaf.value === "number") {
      const n = leaf.value;
      const inside = leaf.op === "lte" ? n : n - 1;
      const outside = leaf.op === "lte" ? n + 1 : n;
      out.push({ name: `Boundary: income ₹${inside}`, kind: "boundary_income", facts: { ...facts, annual_family_income: inside }, expected: ok, now: TEST_NOW });
      out.push({ name: `Boundary: income ₹${outside}`, kind: "boundary_income", facts: { ...facts, annual_family_income: outside }, expected: no, now: TEST_NOW });
    }
  }

  if (c.documents.some((d) => d.required)) {
    out.push({ name: "Missing documents do not change eligibility but are listed", kind: "missing_document", facts, documents: [], expected: ok, expectMissingDocs: true, now: TEST_NOW });
  }

  // Conflicting values for a referenced fact (user-entered vs document-extracted) → manual review.
  const conflictLeaf = leaves.find((l) => l.fact !== "age" && l.fact !== "state" && facts[l.fact] !== undefined && typeof facts[l.fact] !== "object");
  if (conflictLeaf && !closed) {
    const v = facts[conflictLeaf.fact] as FactValue;
    const other: FactValue = typeof v === "boolean" ? !v : typeof v === "number" ? v + 987654 : `${v}_other`;
    out.push({
      name: `Conflicting document value for ${conflictLeaf.fact}`, kind: "conflicting_document",
      facts: { ...facts, [conflictLeaf.fact]: [{ value: v, provenance: "user_entered" }, { value: other, provenance: "document_extracted" }] },
      expected: "needs_manual_review", now: TEST_NOW,
    });
  }

  out.push({ name: "Deadline passed", kind: "expired_deadline", facts, deadlineOverride: "2026-07-01", expected: "expired_or_closed", now: TEST_NOW });

  if (c.stateScope.length > 0) {
    const other = c.stateScope.includes("DL") ? "UP" : "DL";
    out.push({ name: `Lives outside ${c.stateScope.join(", ")}`, kind: "state_mismatch", facts: { ...facts, state: other }, expected: no, now: TEST_NOW });
  } else {
    out.push({ name: "Central scheme applies in any state", kind: "state_mismatch", facts: { ...facts, state: "NL" }, expected: ok, now: TEST_NOW });
  }
  return out;
}

export interface CaseRun {
  name: string;
  kind: string;
  expected: string;
  actual: string;
  passed: boolean;
  detail?: string;
}

export function runCase(c: SchemeContent, t: TestCaseSpec): CaseRun {
  const facts = specToFacts(t.facts);
  // Null-valued overrides (e.g. age_band: null) remove the fact.
  for (const k of Object.keys(facts)) if (facts[k].every((r: FactRecord) => r.value === null)) delete facts[k];
  const docs = t.documents ?? c.documents.flatMap((d) => [d.type]);
  const res = evaluate(toEvaluable(c, { deadline: t.deadlineOverride }), facts, { now: new Date(t.now ?? TEST_NOW), documents: docs });
  let passed = res.status === t.expected;
  let detail: string | undefined;
  if (passed && t.expectMissingDocs) {
    passed = res.documents.some((d) => d.required && !d.present);
    if (!passed) detail = "expected at least one missing required document";
  }
  if (!passed && !detail) {
    detail = res.leaves.filter((l) => l.outcome !== "pass").map((l) => `${l.id}:${l.outcome}`).join(", ");
  }
  return { name: t.name, kind: t.kind, expected: t.expected, actual: res.status, passed, detail };
}

export function runSuite(c: SchemeContent, cases: TestCaseSpec[]): { runs: CaseRun[]; passed: number; failed: number } {
  const runs = cases.map((t) => runCase(c, t));
  return { runs, passed: runs.filter((r) => r.passed).length, failed: runs.filter((r) => !r.passed).length };
}
