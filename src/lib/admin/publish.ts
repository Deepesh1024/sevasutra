import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { publishVersion } from "@/lib/schemes/versioning";
import { runSuite } from "@/lib/schemes/testing";
import type { SchemeContent, TestCaseSpec } from "@/lib/schemes/types";
import { evaluate } from "@/lib/engine/evaluate";
import { evaluable } from "@/lib/schemes/repo";
import { enqueue } from "@/lib/notify/queue";
import type { FactInput } from "@/lib/engine/types";

export async function regressionFor(versionId: string) {
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id: versionId } });
  const cases = await db.ruleTestCase.findMany({ where: { schemeId: v.schemeId }, orderBy: { createdAt: "asc" } });
  const specs = cases.map((c) => c.facts as unknown as TestCaseSpec);
  return runSuite(v.content as unknown as SchemeContent, specs);
}

export type PublishResult = { ok: true; corrections: number; deadlineNotices: number } | { ok: false; error: string };

/**
 * Publishing gate: regression suite must pass; high-impact schemes need a second reviewer who is not the author.
 * After publishing, users whose latest result changes under the new version are notified (content correction).
 */
export async function publishWithChecks(versionId: string, reviewerId: string): Promise<PublishResult> {
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id: versionId }, include: { scheme: true } });
  if (v.status !== "in_review") return { ok: false, error: "Only versions submitted for review can be published." };
  if (!v.changeNote?.trim()) return { ok: false, error: "A change note is required (no unexplained rule changes)." };
  if (v.scheme.highImpact && (!v.authorId || v.authorId === reviewerId)) return { ok: false, error: "High-impact scheme: a second curator (not the author) must approve." };
  const suite = await regressionFor(versionId);
  if (suite.failed > 0) return { ok: false, error: `${suite.failed} regression test(s) failing. Fix the rule or update the tests first.` };

  const prev = await db.schemeVersion.findFirst({ where: { schemeId: v.schemeId, status: "published" }, include: { rule: true } });
  await db.$transaction((tx) => publishVersion(tx, versionId, reviewerId));
  await audit({ actorId: reviewerId, actorType: "admin", action: "scheme.published", entityType: "scheme_version", entityId: versionId, metadata: { schemeId: v.schemeId, version: v.version, previous: prev?.id, tests: suite.passed } });

  const next = await db.schemeVersion.findUniqueOrThrow({ where: { id: versionId }, include: { rule: true } });
  let corrections = 0;
  let deadlineNotices = 0;
  if (prev) {
    // Latest evaluation per (user, profile) for this scheme.
    const evals = await db.evaluation.findMany({ where: { schemeId: v.schemeId }, orderBy: { createdAt: "desc" } });
    const seen = new Set<string>();
    for (const e of evals) {
      const k = `${e.userId}:${e.profileId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (e.schemeVersionId === versionId) continue;
      const snap = e.inputSnapshot as unknown as { facts: FactInput; documents: string[] };
      const r = evaluate(evaluable(next), snap.facts, { documents: snap.documents });
      if (r.status !== e.status) {
        await enqueue(db, e.userId, "content_correction", `correction:${e.id}:${versionId}`, { schemeId: v.schemeId });
        corrections++;
      }
    }
    if ((prev.deadline?.getTime() ?? 0) !== (next.deadline?.getTime() ?? 0)) {
      const savers = await db.savedScheme.findMany({ where: { schemeId: v.schemeId } });
      for (const s of savers) { await enqueue(db, s.userId, "deadline_changed", `deadline_change:${s.userId}:${versionId}`, { schemeId: v.schemeId }); deadlineNotices++; }
    }
  }
  return { ok: true, corrections, deadlineNotices };
}
