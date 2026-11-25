// Version creation & content indexing. No "server-only" import so the seed script can use it too.
import type { PrismaClient, Prisma } from "@prisma/client";
import { hashRule } from "@/lib/engine/evaluate";
import type { RuleNode } from "@/lib/engine/types";
import type { SchemeContent } from "./types";

const INJECTION_PATTERNS = [
  /ignore (all|any|the)? ?(previous|prior|above) (instructions|prompts?)/i,
  /disregard (the|all|previous) (instructions|rules)/i,
  /\bsystem prompt\b/i,
  /you are (now )?(an?|the) (ai|assistant|chatbot)/i,
  /\b(act|behave) as\b.*\b(admin|developer|system)\b/i,
  /<\s*\/?\s*(system|assistant|instructions?)\s*>/i,
  /\b(always|must) (say|answer|reply) (that )?(the user|you) (is|are) eligible\b/i,
  /reveal (your|the) (prompt|instructions|secrets?)/i,
];

/** Flags text that tries to instruct the model. Flagged chunks are excluded from retrieval and shown to curators. */
export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function leafLabels(n: RuleNode, neg = false): string[] {
  if ("fact" in n || "doc" in n) return [`${neg ? "Not: " : ""}${n.label.en}`];
  if ("all" in n) return n.all.flatMap((x) => leafLabels(x, neg));
  if ("any" in n) return [`One of: ${n.any.flatMap((x) => leafLabels(x, neg)).join("; ")}`];
  return leafLabels(n.not, !neg);
}

export function chunksFor(c: SchemeContent): { section: string; locale: string; text: string; sourceId?: string }[] {
  const src = c.sources[0]?.sourceId;
  const out: { section: string; locale: string; text: string; sourceId?: string }[] = [
    { section: "Summary", locale: "en", text: `${c.name.en}. ${c.summary.en}`, sourceId: src },
    { section: "Official description", locale: "en", text: c.officialDescription.en, sourceId: src },
    { section: "Eligibility criteria", locale: "en", text: `Eligibility for ${c.name.en}: ${leafLabels(c.rule.mandatory).join(". ")}.${c.stateScope.length ? ` Only for residents of: ${c.stateScope.join(", ")}.` : ""}`, sourceId: src },
    { section: "Benefit", locale: "en", text: `Benefit of ${c.name.en}: ${c.benefit.basis.en}${c.benefit.amountMax ? ` (stated maximum ₹${c.benefit.amountMax.toLocaleString("en-IN")})` : ""}.`, sourceId: src },
    { section: "Documents", locale: "en", text: `Documents for ${c.name.en}: ${c.documents.map((d) => `${d.label.en}${d.required ? " (required)" : " (optional)"}${d.alternatives?.length ? ` or alternatives: ${d.alternatives.join(", ")}` : ""}`).join("; ")}.`, sourceId: src },
    { section: "How to apply", locale: "en", text: `How to apply for ${c.name.en}: ${c.application.steps.map((s) => s.en).join(" ")} Fee: ${c.application.fee.en} ${c.application.deadlineNote?.en ?? ""} Official link: ${c.application.url ?? "visit the department office"}.`, sourceId: src },
    { section: "Help and grievances", locale: "en", text: `Help for ${c.name.en}: ${c.application.grievance.en} Status: ${c.application.statusTracking.en}`, sourceId: src },
  ];
  if (c.rule.caveats?.length) out.push({ section: "Notes and caveats", locale: "en", text: `Notes for ${c.name.en}: ${c.rule.caveats.map((x) => x.en).join(" ")}`, sourceId: src });
  if (c.summary.hi) out.push({ section: "सारांश", locale: "hi", text: `${c.name.hi ?? c.name.en}। ${c.summary.hi}`, sourceId: src });
  for (const f of c.faqs ?? []) out.push({ section: "FAQ", locale: "en", text: `Q: ${f.q.en} A: ${f.a.en}`, sourceId: src });
  return out;
}

export function denormalise(c: SchemeContent) {
  return {
    name: c.name.en,
    ministry: c.ministry,
    level: c.level,
    stateScope: c.stateScope,
    category: c.category,
    kind: c.kind,
    scholarshipType: c.scholarshipType ?? null,
    benefitType: c.benefit.kind,
    applicationMode: c.application.mode,
    lifecycleStatus: c.lifecycleStatus,
    deadline: c.application.deadline ? new Date(c.application.deadline) : null,
    isThirdParty: c.isThirdParty,
  };
}

type Tx = PrismaClient | Prisma.TransactionClient;

/** Create a new immutable version (draft by default) with its rule and search chunks. */
export async function createVersion(tx: Tx, c: SchemeContent, opts: { status?: string; authorId?: string | null; changeNote?: string; lastVerifiedAt?: Date | null; effectiveUntil?: Date | null } = {}) {
  await tx.scheme.upsert({ where: { id: c.schemeId }, update: { highImpact: !!c.highImpact }, create: { id: c.schemeId, highImpact: !!c.highImpact } });
  const last = await tx.schemeVersion.findFirst({ where: { schemeId: c.schemeId }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const v = await tx.schemeVersion.create({
    data: {
      schemeId: c.schemeId, version, status: opts.status ?? "draft", content: c as never, changeNote: opts.changeNote,
      authorId: opts.authorId ?? null, lastVerifiedAt: opts.lastVerifiedAt ?? null, ...denormalise(c),
      rule: { create: { definition: c.rule as never, ruleHash: hashRule(c.rule), effectiveFrom: new Date(c.effectiveFrom), effectiveUntil: opts.effectiveUntil ?? null } },
    },
  });
  const chunks = chunksFor(c);
  await tx.contentChunk.createMany({ data: chunks.map((ch) => ({ ...ch, schemeVersionId: v.id, injectionFlag: detectInjection(ch.text) })) });
  return v;
}

/** Publish: previous published version becomes "superseded" (kept for reproducibility). */
export async function publishVersion(tx: Tx, versionId: string, reviewerId: string | null) {
  const v = await tx.schemeVersion.findUniqueOrThrow({ where: { id: versionId } });
  await tx.schemeVersion.updateMany({ where: { schemeId: v.schemeId, status: "published" }, data: { status: "superseded" } });
  const now = new Date();
  await tx.schemeVersion.update({ where: { id: versionId }, data: { status: "published", publishedAt: now, reviewerId, reviewedAt: reviewerId ? now : null } });
  await tx.scheme.update({ where: { id: v.schemeId }, data: { currentVersionId: versionId } });
}
