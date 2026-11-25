import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { FIELD_MAP, type FieldDef } from "./fields";
import type { FactInput, FactRecord, FactValue, Provenance } from "@/lib/engine/types";
import type { ConsentPurpose } from "@/lib/consent";
import { NOTICE_VERSION } from "@/lib/consent";
import type { User } from "@prisma/client";
import { isApplicant } from "@/lib/auth/roles";

export async function ensurePrimaryProfile(userId: string) {
  const p = await db.profile.findFirst({ where: { userId, isPrimary: true } });
  return p ?? db.profile.create({ data: { userId, isPrimary: true, label: "Me", relationship: "self" } });
}

export async function getProfiles(userId: string) {
  await ensurePrimaryProfile(userId);
  return db.profile.findMany({ where: { userId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
}

export async function activeFacts(profileId: string) {
  return db.profileFact.findMany({ where: { profileId, supersededAt: null }, orderBy: { collectedAt: "asc" } });
}

/**
 * Engine input for a profile: the profile's own active facts plus household-level facts from the primary
 * profile (e.g. family income, ration card) when this is a household member.
 */
export async function factInputFor(profileId: string): Promise<FactInput> {
  const profile = await db.profile.findUniqueOrThrow({ where: { id: profileId } });
  const own = await activeFacts(profileId);
  const out: FactInput = {};
  const add = (f: { key: string; value: unknown; provenance: string; collectedAt: Date; verifiedAt: Date | null; expiresAt: Date | null }) => {
    const rec: FactRecord = {
      key: f.key, value: f.value as FactValue, provenance: f.provenance as Provenance,
      collectedAt: f.collectedAt.toISOString(), verifiedAt: f.verifiedAt?.toISOString() ?? null, expiresAt: f.expiresAt?.toISOString() ?? null,
    };
    (out[f.key] ??= []).push(rec);
  };
  own.forEach(add);
  if (!profile.isPrimary) {
    const primary = await db.profile.findFirst({ where: { userId: profile.userId, isPrimary: true } });
    if (primary) {
      const hh = await activeFacts(primary.id);
      for (const f of hh) if (FIELD_MAP[f.key]?.household && !out[f.key]) add(f);
      // Household members inherit the household's state and area unless set.
      for (const f of hh) if ((f.key === "state" || f.key === "residence_area") && !out[f.key]) add(f);
    }
  }
  return out;
}

export async function hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
  // Document consent must be on the current notice (it changed when OCR + AI type checks were added).
  const versioned = purpose === "documents" ? { noticeVersion: NOTICE_VERSION } : {};
  const c = await db.consent.findFirst({ where: { userId, purpose, granted: true, withdrawnAt: null, ...versioned }, orderBy: { createdAt: "desc" } });
  return !!c;
}

export async function grantConsent(userId: string, purpose: ConsentPurpose, profileId?: string) {
  const c = await db.consent.create({ data: { userId, purpose, granted: true, noticeVersion: NOTICE_VERSION, profileId } });
  await audit({ actorId: userId, actorType: "user", action: "consent.granted", entityType: "consent", entityId: c.id, metadata: { purpose, noticeVersion: NOTICE_VERSION } });
  return c;
}

export async function withdrawConsent(userId: string, purpose: ConsentPurpose) {
  await db.consent.updateMany({ where: { userId, purpose, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
  await audit({ actorId: userId, actorType: "user", action: "consent.withdrawn", entityType: "consent", metadata: { purpose } });
  if (purpose === "profile_sensitive") {
    // Purpose limitation: withdrawing consent erases the sensitive answers.
    const sensitiveKeys = Object.values(FIELD_MAP).filter((f) => f.sensitive).map((f) => f.key);
    const profiles = await db.profile.findMany({ where: { userId }, select: { id: true } });
    await db.profileFact.deleteMany({ where: { profileId: { in: profiles.map((p) => p.id) }, key: { in: sensitiveKeys } } });
  }
}

export function canSaveField(user: User, field: FieldDef): "ok" | "needs_phone" {
  if (isApplicant(user)) return "ok";
  return field.discovery ? "ok" : "needs_phone";
}

/** Parse a raw form value into a typed fact value. Returns undefined to skip (empty input). */
export function parseFieldValue(field: FieldDef, raw: string | string[] | null): FactValue | undefined {
  if (raw === null) return undefined;
  if (Array.isArray(raw)) return field.type === "multiselect" ? raw.filter((x) => field.options?.some((o) => o.value === x)) : undefined;
  const v = raw.trim();
  if (v === "") return undefined;
  if (v === "prefer_not_to_say" || v === "not_sure") return v;
  switch (field.type) {
    case "boolean": return v === "true" ? true : v === "false" ? false : undefined;
    case "number": case "money": {
      const n = Number(v.replace(/[,₹\s]/g, ""));
      if (!Number.isFinite(n)) return undefined;
      if (field.min !== undefined && n < field.min) return undefined;
      if (field.max !== undefined && n > field.max) return undefined;
      return n;
    }
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) || d > new Date() || d.getUTCFullYear() < 1900 ? undefined : v;
    }
    case "select": return field.options?.some((o) => o.value === v) ? v : undefined;
    case "text": return v.slice(0, 100);
    default: return undefined;
  }
}

/** Save user-entered values. Each change supersedes the previous user_entered record (history kept). */
export async function saveUserFacts(user: User, profileId: string, values: Record<string, FactValue>) {
  const profile = await db.profile.findFirstOrThrow({ where: { id: profileId, userId: user.id } });
  const changed: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const field = FIELD_MAP[key];
    if (!field) continue;
    if (canSaveField(user, field) !== "ok") continue;
    if (field.sensitive && value !== "prefer_not_to_say" && !(await hasConsent(user.id, "profile_sensitive"))) continue;
    // Household-level facts live on the primary profile.
    const targetProfileId = field.household && !profile.isPrimary ? (await ensurePrimaryProfile(user.id)).id : profile.id;
    const existing = await db.profileFact.findFirst({ where: { profileId: targetProfileId, key, provenance: "user_entered", supersededAt: null } });
    if (existing && JSON.stringify(existing.value) === JSON.stringify(value)) continue;
    await db.$transaction([
      ...(existing ? [db.profileFact.update({ where: { id: existing.id }, data: { supersededAt: new Date() } })] : []),
      db.profileFact.create({ data: { profileId: targetProfileId, key, value: value as never, provenance: "user_entered", source: "profile form" } }),
    ]);
    changed.push(key);
  }
  if (changed.length) {
    await audit({ actorId: user.id, actorType: "user", action: "profile.updated", entityType: "profile", entityId: profileId, metadata: { keys: changed } });
  }
  return changed;
}

export async function deleteFact(user: User, profileId: string, key: string) {
  await db.profile.findFirstOrThrow({ where: { id: profileId, userId: user.id } });
  await db.profileFact.deleteMany({ where: { profileId, key, provenance: "user_entered" } });
  await audit({ actorId: user.id, actorType: "user", action: "profile.fact_deleted", entityType: "profile", entityId: profileId, metadata: { key } });
}
