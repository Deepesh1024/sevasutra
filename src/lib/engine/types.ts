// Declarative eligibility rule model. The engine is the only component allowed to decide
// eligibility; LLMs may explain its output but never override it.

export type Locale = "en" | "hi";
export type Localized = { en: string; hi?: string };

export type Provenance =
  | "user_entered"
  | "document_extracted"
  | "government_verified"
  | "operator_verified";

export const PROVENANCE_TRUST: Record<Provenance, number> = {
  user_entered: 0,
  document_extracted: 1,
  operator_verified: 2,
  government_verified: 3,
};

/** A numeric value may be exact or an inclusive interval (e.g. from an age or income band). */
export type Interval = { min?: number; max?: number };
export type FactValue = string | number | boolean | string[] | Interval | null;

export interface FactRecord {
  key: string;
  value: FactValue;
  provenance: Provenance;
  collectedAt?: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
}

/** Active fact records keyed by fact name. More than one record per key may exist (conflict detection). */
export type FactInput = Record<string, FactRecord[]>;

export type Op =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gte"
  | "gt"
  | "lte"
  | "lt"
  | "between"
  | "is_true"
  | "is_false"
  | "exists"
  | "contains"
  | "not_contains";

export interface FactLeaf {
  id: string;
  fact: string;
  op: Op;
  value?: FactValue | [number, number];
  label: Localized;
  /** Shown in "what would change this result?" when the leaf fails. */
  changeHint?: Localized;
  /** If true, a pass based only on user_entered data counts as unverified. */
  requireVerified?: boolean;
}

export interface DocLeaf {
  id: string;
  doc: string;
  op: "present";
  label: Localized;
  changeHint?: Localized;
}

export interface AllNode { all: RuleNode[]; id?: string; label?: Localized }
export interface AnyNode { any: RuleNode[]; id?: string; label?: Localized }
export interface NotNode { not: RuleNode; id?: string; label?: Localized }

export type RuleNode = AllNode | AnyNode | NotNode | FactLeaf | DocLeaf;

export interface RuleException {
  id: string;
  /** Lower number = higher precedence. The first matching exception wins. */
  priority: number;
  when: RuleNode;
  effect: "eligible" | "not_eligible" | "needs_manual_review";
  explanation: Localized;
}

export interface RuleDefinition {
  schemaVersion: 1;
  /** Reference date used for age and other date-derived facts. ISO date, "today", or "academic_year_start". */
  referenceDate?: string;
  mandatory: RuleNode;
  exceptions?: RuleException[];
  /** Caps, quotas and limits the engine cannot evaluate per person; always shown to the user. */
  caveats?: Localized[];
  /** Curator flag: the guideline is ambiguous and every result needs manual review. */
  ambiguous?: { note: Localized };
}

// ───────────── Scheme content used by the engine ─────────────

export type BenefitKind =
  | "cash"
  | "reimbursement"
  | "subsidy"
  | "service"
  | "insurance"
  | "loan"
  | "fee_waiver"
  | "non_cash"
  | "savings"
  | "pension";

export type BenefitFrequency =
  | "one_time"
  | "monthly"
  | "annual"
  | "per_installment"
  | "per_event"
  | "on_maturity";

export interface BenefitTier {
  id: string;
  when: RuleNode;
  amount: number;
  label: Localized;
}

export interface BenefitSpec {
  kind: BenefitKind;
  /** Stated amount range in INR, when the guideline states one. */
  amountMin?: number;
  amountMax?: number;
  frequency?: BenefitFrequency;
  /** Months per year the frequency applies (e.g. 10 for a 10-month maintenance allowance). */
  periodsPerYear?: number;
  durationNote?: Localized;
  /** Mandatory human-readable basis, e.g. "maximum annual scholarship amount stated in the guideline". */
  basis: Localized;
  /** True when the guideline states a fixed amount; false when the amount is a ceiling/estimate. */
  stated: boolean;
  /** Is this money paid to the citizen? Insurance cover and loans are not counted in totals. */
  countsAsMoney: boolean;
  /** Schemes in the same group cannot be combined; totals take the maximum within a group. */
  exclusivityGroup?: string;
  tiers?: BenefitTier[];
}

export interface DocumentRequirement {
  type: string;
  label: Localized;
  required: boolean;
  alternatives?: string[];
  validityMonths?: number;
  verification?: Localized;
  /** Only needed when this condition holds (e.g. caste certificate only for reserved categories). */
  onlyIf?: RuleNode;
}

// ───────────── Results ─────────────

export type EligibilityStatus =
  | "eligible"
  | "partially_eligible"
  | "not_eligible"
  | "expired_or_closed"
  | "needs_manual_review";

export type LeafOutcome = "pass" | "fail" | "unknown" | "unverified" | "conflict" | "declined";

export interface LeafResult {
  id: string;
  kind: "fact" | "document";
  fact?: string;
  doc?: string;
  op: string;
  expected?: unknown;
  actual?: unknown;
  provenance?: Provenance | "mixed";
  outcome: LeafOutcome;
  label: Localized;
  explanation: Localized;
  changeHint?: Localized;
  /** Whether this leaf affected the final decision (false for an unused branch of an `any`). */
  decisive: boolean;
}

export interface DocumentCheck {
  type: string;
  label: Localized;
  required: boolean;
  present: boolean;
  satisfiedBy?: string;
  alternatives: { type: string; label: Localized }[];
  verification?: Localized;
}

export interface BenefitEstimate {
  kind: BenefitKind;
  amount?: number;
  amountMin?: number;
  amountMax?: number;
  annualised?: number;
  frequency?: BenefitFrequency;
  stated: boolean;
  countsAsMoney: boolean;
  exclusivityGroup?: string;
  basis: Localized;
  calculation: Localized[];
}

export interface EvaluationResult {
  engineVersion: string;
  ruleHash: string;
  referenceDate: string;
  status: EligibilityStatus;
  headline: Localized;
  leaves: LeafResult[];
  exceptionApplied?: { id: string; effect: string; explanation: Localized };
  documents: DocumentCheck[];
  benefit?: BenefitEstimate;
  whatWouldChange: Localized[];
  caveats: Localized[];
  closedReason?: Localized;
  manualReviewReason?: Localized;
  disclaimer: Localized;
}
