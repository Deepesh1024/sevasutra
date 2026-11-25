import { PROVENANCE_TRUST, type FactInput, type FactRecord, type FactValue, type Interval, type Provenance } from "./types";

export const UNKNOWN_SENTINELS = new Set(["prefer_not_to_say", "not_sure", ""]);

/** A fact after conflict resolution, ready for evaluation. */
export type ResolvedFact =
  | { state: "missing" }
  | { state: "declined"; provenance: Provenance }
  | { state: "conflict"; values: { value: FactValue; provenance: Provenance }[] }
  | {
      state: "known";
      value: FactValue;
      provenance: Provenance | "mixed";
      verified: boolean;
      note?: string;
    };

export type ResolvedFacts = Record<string, ResolvedFact>;

function sameValue(a: FactValue, b: FactValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isExpired(r: FactRecord, ref: Date): boolean {
  return !!r.expiresAt && new Date(r.expiresAt).getTime() < ref.getTime();
}

/**
 * Conflict resolution:
 * - Expired records are ignored.
 * - If all active records agree → known (verified if any non-user source).
 * - If a government_verified record exists, it is authoritative; disagreement is surfaced as a note.
 * - Otherwise disagreeing records → conflict (first-class state, leads to manual review).
 */
export function resolveFact(records: FactRecord[] | undefined, ref: Date): ResolvedFact {
  const active = (records ?? []).filter((r) => !isExpired(r, ref) && r.value !== null && r.value !== undefined);
  if (active.length === 0) return { state: "missing" };

  const meaningful = active.filter((r) => !(typeof r.value === "string" && UNKNOWN_SENTINELS.has(r.value)));
  if (meaningful.length === 0) {
    const declined = active.find((r) => r.value === "prefer_not_to_say");
    return declined ? { state: "declined", provenance: declined.provenance } : { state: "missing" };
  }

  const distinct: FactRecord[] = [];
  for (const r of meaningful) if (!distinct.some((d) => sameValue(d.value, r.value))) distinct.push(r);

  const verified = meaningful.some((r) => r.provenance !== "user_entered");
  if (distinct.length === 1) {
    const provs = new Set(meaningful.map((r) => r.provenance));
    return {
      state: "known",
      value: distinct[0].value,
      provenance: provs.size > 1 ? "mixed" : meaningful[0].provenance,
      verified,
    };
  }

  const gov = meaningful.filter((r) => r.provenance === "government_verified");
  if (gov.length > 0 && gov.every((g) => sameValue(g.value, gov[0].value))) {
    return {
      state: "known",
      value: gov[0].value,
      provenance: "government_verified",
      verified: true,
      note: "A government-verified value was used; it differs from another value on your profile.",
    };
  }

  return {
    state: "conflict",
    values: distinct
      .sort((a, b) => PROVENANCE_TRUST[b.provenance] - PROVENANCE_TRUST[a.provenance])
      .map((r) => ({ value: r.value, provenance: r.provenance })),
  };
}

/** Whole years between dob and ref. */
export function ageOn(dob: Date, ref: Date): number {
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const m = ref.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function parseBand(band: string): Interval | null {
  const m = /^(\d+)-(\d+)$/.exec(band);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]) };
}

/** Indian academic year containing `ref`, e.g. 2026-27 (starts 1 April for NSP purposes). */
export function academicYear(ref: Date): string {
  const y = ref.getUTCFullYear();
  const start = ref.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function resolveReferenceDate(spec: string | undefined, now: Date): Date {
  if (!spec || spec === "today") return now;
  if (spec === "academic_year_start") {
    const y = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return new Date(Date.UTC(y, 3, 1));
  }
  const d = new Date(spec);
  return isNaN(d.getTime()) ? now : d;
}

/** Resolve all facts and add derived facts (age, academic_year). */
export function buildFacts(input: FactInput, ref: Date): ResolvedFacts {
  const out: ResolvedFacts = {};
  for (const [key, records] of Object.entries(input)) out[key] = resolveFact(records, ref);

  // Derived: age on reference date — from date of birth, else from age band (interval).
  const dob = out["date_of_birth"];
  const band = out["age_band"];
  if (dob?.state === "known" && typeof dob.value === "string") {
    const d = new Date(dob.value);
    if (!isNaN(d.getTime())) {
      out["age"] = { state: "known", value: ageOn(d, ref), provenance: dob.provenance, verified: dob.verified };
    }
  } else if (dob?.state === "conflict") {
    out["age"] = { state: "conflict", values: dob.values };
  } else if (band?.state === "known" && typeof band.value === "string") {
    const iv = parseBand(band.value);
    if (iv) out["age"] = { state: "known", value: iv, provenance: band.provenance, verified: false };
  } else if (band?.state === "declined" || dob?.state === "declined") {
    out["age"] = { state: "declined", provenance: "user_entered" };
  }
  if (!out["age"]) out["age"] = { state: "missing" };

  out["academic_year"] = { state: "known", value: academicYear(ref), provenance: "operator_verified", verified: true };
  return out;
}
