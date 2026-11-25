import "server-only";
import { db } from "@/lib/db";
import { evaluate, factsReferenced, stableStringify, ENGINE_VERSION } from "@/lib/engine/evaluate";
import type { EvaluationResult, FactInput } from "@/lib/engine/types";
import { sha256 } from "@/lib/crypto";
import { evaluable, type PublishedScheme } from "@/lib/schemes/repo";
import { factInputFor } from "@/lib/profile/service";

export async function vaultDocTypes(userId: string, profileId?: string): Promise<string[]> {
  const docs = await db.document.findMany({
    where: {
      userId, status: "active", scanStatus: "clean",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(profileId ? { AND: [{ OR: [{ profileId }, { profileId: null }] }] } : {}),
    },
    select: { docType: true },
  });
  return [...new Set(docs.map((d) => d.docType))];
}

/** Keep only the facts a rule actually uses — the evaluation snapshot stores no more than needed. */
function minimalSnapshot(v: PublishedScheme, input: FactInput): FactInput {
  const keys = new Set<string>(["state"]);
  const rule = evaluable(v).rule;
  factsReferenced(rule.mandatory, keys);
  for (const ex of rule.exceptions ?? []) factsReferenced(ex.when, keys);
  if (keys.has("date_of_birth")) keys.add("age_band");
  const out: FactInput = {};
  for (const k of keys) if (input[k]) out[k] = input[k];
  return out;
}

/**
 * Evaluate a published scheme for a profile and persist an immutable, reproducible Evaluation
 * (rule version id + rule hash + engine version + minimal input snapshot). Identical inputs reuse the last row.
 */
export async function evaluateAndRecord(userId: string, profileId: string, v: PublishedScheme, now = new Date()) {
  const input = await factInputFor(profileId);
  const docs = await vaultDocTypes(userId, profileId);
  const result = evaluate(evaluable(v), input, { now, documents: docs });
  const snapshot = minimalSnapshot(v, input);
  const inputHash = sha256(stableStringify({ snapshot, docs, ref: result.referenceDate })).slice(0, 32);

  const last = await db.evaluation.findFirst({ where: { userId, profileId, schemeId: v.schemeId }, orderBy: { createdAt: "desc" } });
  if (last && last.inputHash === inputHash && last.schemeVersionId === v.id && last.status === result.status && last.engineVersion === ENGINE_VERSION) {
    return { evaluation: last, result: last.result as unknown as EvaluationResult, previous: null };
  }
  const evaluation = await db.evaluation.create({
    data: {
      userId, profileId, schemeId: v.schemeId, schemeVersionId: v.id, ruleHash: result.ruleHash, engineVersion: ENGINE_VERSION,
      referenceDate: new Date(result.referenceDate), inputSnapshot: { facts: snapshot, documents: docs } as never, inputHash,
      status: result.status, result: result as never,
    },
  });
  return { evaluation, result, previous: last };
}

/** Re-run a stored evaluation against its own historical rule version — proves reproducibility. */
export async function reproduce(evaluationId: string) {
  const e = await db.evaluation.findUniqueOrThrow({ where: { id: evaluationId } });
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id: e.schemeVersionId }, include: { rule: true } });
  const snap = e.inputSnapshot as unknown as { facts: FactInput; documents: string[] };
  const result = evaluate(evaluable(v), snap.facts, { now: e.createdAt, documents: snap.documents });
  return { original: e.status, reproduced: result.status, matches: result.status === e.status && result.ruleHash === e.ruleHash };
}
