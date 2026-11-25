import { describe, expect, it } from "vitest";
import { SCHEMES } from "@/lib/schemes/data";
import { SOURCES } from "@/lib/schemes/sources";
import { generateCases, runSuite } from "@/lib/schemes/testing";
import type { RuleNode } from "@/lib/engine/types";
import { FIELD_MAP } from "@/lib/profile/fields";

function leafIds(n: RuleNode): string[] {
  if ("fact" in n || "doc" in n) return [n.id];
  if ("all" in n) return n.all.flatMap(leafIds);
  if ("any" in n) return n.any.flatMap(leafIds);
  return leafIds(n.not);
}
function factKeys(n: RuleNode): string[] {
  if ("fact" in n) return [n.fact];
  if ("doc" in n) return [];
  if ("all" in n) return n.all.flatMap(factKeys);
  if ("any" in n) return n.any.flatMap(factKeys);
  return factKeys(n.not);
}

describe("curated catalogue", () => {
  it("has at least 20 schemes with unique ids", () => {
    expect(SCHEMES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SCHEMES.map((s) => s.content.schemeId)).size).toBe(SCHEMES.length);
  });

  for (const { content, tests } of SCHEMES) {
    describe(content.schemeId, () => {
      it("cites registered sources and an application route", () => {
        expect(content.sources.length).toBeGreaterThan(0);
        for (const s of content.sources) expect(SOURCES.find((x) => x.id === s.sourceId), s.sourceId).toBeTruthy();
        expect(content.application.url || content.application.mode === "department_office").toBeTruthy();
        expect(content.benefit.basis.en.length).toBeGreaterThan(10);
      });
      it("third-party schemes are labelled and never marked official", () => {
        if (content.isThirdParty) {
          expect(content.provider?.name).toBeTruthy();
          for (const s of content.sources) expect(SOURCES.find((x) => x.id === s.sourceId)?.isOfficial).toBe(false);
        }
      });
      it("uses unique leaf ids and only known profile facts", () => {
        const ids = leafIds(content.rule.mandatory);
        expect(new Set(ids).size).toBe(ids.length);
        for (const k of factKeys(content.rule.mandatory)) expect(k === "age" || !!FIELD_MAP[k], `unknown fact ${k}`).toBe(true);
      });
      it("has the required regression case kinds", () => {
        const all = [...tests, ...generateCases(content, tests)];
        const kinds = new Set(all.map((t) => t.kind));
        for (const k of ["eligible", "ineligible", "missing_document", "expired_deadline", "state_mismatch"]) expect(kinds.has(k as never), k).toBe(true);
      });
      it("passes all hand-written and generated regression cases", () => {
        const suite = runSuite(content, [...tests, ...generateCases(content, tests)]);
        const failures = suite.runs.filter((r) => !r.passed);
        expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
      });
    });
  }
});
