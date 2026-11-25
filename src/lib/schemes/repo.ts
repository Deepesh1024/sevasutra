import "server-only";
import { db } from "@/lib/db";
import type { Prisma, SchemeVersion, EligibilityRule } from "@prisma/client";
import type { SchemeContent } from "./types";
import type { SchemeForEvaluation } from "@/lib/engine/evaluate";
import type { RuleDefinition } from "@/lib/engine/types";

export type PublishedScheme = SchemeVersion & { rule: EligibilityRule | null };

export const STALE_DAYS = 180;

export function contentOf(v: SchemeVersion): SchemeContent {
  return v.content as unknown as SchemeContent;
}

export function freshness(v: SchemeVersion): "unverified" | "stale" | "fresh" {
  if (!v.lastVerifiedAt) return "unverified";
  return Date.now() - v.lastVerifiedAt.getTime() > STALE_DAYS * 86400_000 ? "stale" : "fresh";
}

export function evaluable(v: PublishedScheme): SchemeForEvaluation {
  const c = contentOf(v);
  return {
    id: v.schemeId,
    lifecycleStatus: v.lifecycleStatus,
    deadline: v.deadline?.toISOString() ?? null,
    opensAt: c.application.opensAt ?? null,
    rule: (v.rule?.definition as unknown as RuleDefinition) ?? c.rule,
    ruleEffectiveFrom: v.rule?.effectiveFrom.toISOString() ?? null,
    ruleEffectiveUntil: v.rule?.effectiveUntil?.toISOString() ?? null,
    documents: c.documents,
    benefit: c.benefit,
    stateScope: v.stateScope,
  };
}

export interface SchemeFilters {
  q?: string;
  ministry?: string;
  level?: string;
  state?: string;
  category?: string;
  kind?: string;
  benefitType?: string;
  mode?: string;
  scholarshipType?: string;
  deadline?: "30d" | "open" | "any";
  target?: string;
}

export async function listPublished(f: SchemeFilters = {}): Promise<PublishedScheme[]> {
  const where: Prisma.SchemeVersionWhereInput = { status: "published" };
  if (f.ministry) where.ministry = f.ministry;
  if (f.level) where.level = f.level;
  if (f.category) where.category = f.category;
  if (f.kind) where.kind = f.kind;
  if (f.benefitType) where.benefitType = f.benefitType;
  if (f.mode) where.applicationMode = f.mode;
  if (f.scholarshipType) where.scholarshipType = f.scholarshipType;
  if (f.state) where.OR = [{ stateScope: { isEmpty: true } }, { stateScope: { has: f.state } }];
  if (f.deadline === "30d") where.deadline = { gte: new Date(), lte: new Date(Date.now() + 30 * 86400_000) };
  if (f.deadline === "open") where.lifecycleStatus = "open";

  let ids: string[] | null = null;
  if (f.q && f.q.trim()) {
    // Postgres full-text search over published content chunks + names (simple config works for Hindi and English tokens).
    const q = f.q.trim().slice(0, 100);
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT sv.id FROM "SchemeVersion" sv
      LEFT JOIN "ContentChunk" cc ON cc."schemeVersionId" = sv.id AND cc."injectionFlag" = false
      WHERE sv.status = 'published' AND (
        to_tsvector('simple', sv.name || ' ' || sv.ministry || ' ' || sv.category) @@ plainto_tsquery('simple', ${q})
        OR to_tsvector('simple', coalesce(cc.text, '')) @@ plainto_tsquery('simple', ${q})
        OR sv.name ILIKE ${"%" + q + "%"}
        OR sv.content::text ILIKE ${"%" + q + "%"}
      )`;
    ids = rows.map((r) => r.id);
    where.id = { in: ids };
  }

  let rows = await db.schemeVersion.findMany({ where, include: { rule: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
  if (f.target) rows = rows.filter((r) => contentOf(r).targetGroups.includes(f.target!));
  return rows;
}

export async function getPublished(schemeId: string): Promise<PublishedScheme | null> {
  const s = await db.scheme.findUnique({ where: { id: schemeId }, include: { currentVersion: { include: { rule: true } } } });
  return s?.currentVersion ?? null;
}

export async function getVersion(id: string): Promise<PublishedScheme | null> {
  return db.schemeVersion.findUnique({ where: { id }, include: { rule: true } });
}

export async function facetValues() {
  const rows = await db.schemeVersion.findMany({
    where: { status: "published" },
    select: { ministry: true, level: true, category: true, benefitType: true, applicationMode: true, scholarshipType: true, kind: true, content: true },
  });
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
  return {
    ministries: uniq(rows.map((r) => r.ministry)),
    levels: uniq(rows.map((r) => r.level)),
    categories: uniq(rows.map((r) => r.category)),
    benefitTypes: uniq(rows.map((r) => r.benefitType)),
    modes: uniq(rows.map((r) => r.applicationMode)),
    scholarshipTypes: uniq(rows.map((r) => r.scholarshipType)),
    targets: uniq(rows.flatMap((r) => (r.content as unknown as SchemeContent).targetGroups)),
  };
}
