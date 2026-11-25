import type { BenefitSpec, DocumentRequirement, FactValue, Localized, Provenance, RuleDefinition } from "@/lib/engine/types";

export type SchemeLevel = "central" | "state" | "UT" | "local" | "joint";
export type ApplicationMode = "official_portal" | "official_url" | "authorised_api" | "csc_offline" | "department_office" | "unavailable";
export type ScholarshipType = "central" | "state" | "university" | "corporate_csr" | "fellowship";
export type Lifecycle = "open" | "closed" | "upcoming" | "discontinued";

/** Canonical scheme record. Stored as JSON on each immutable SchemeVersion. */
export interface SchemeContent {
  schemeId: string;
  name: Localized;
  aliases: string[];
  ministry: string;
  department?: string;
  level: SchemeLevel;
  stateScope: string[]; // empty = all India
  category: string; // agriculture | banking | insurance | health | housing | energy | women_child | social_security | education | business | pension
  targetGroups: string[];
  kind: "scheme" | "scholarship";
  scholarshipType?: ScholarshipType;
  lifecycleStatus: Lifecycle;
  isThirdParty: boolean;
  provider?: { name: string; termsUrl?: string; privacyUrl?: string };
  summary: Localized;
  officialDescription: Localized;
  benefit: BenefitSpec;
  rule: RuleDefinition;
  documents: DocumentRequirement[];
  application: {
    mode: ApplicationMode;
    url?: string;
    steps: Localized[];
    fee: Localized;
    deadline?: string | null;
    opensAt?: string | null;
    deadlineNote?: Localized;
    renewal?: Localized;
    renewalMonths?: number;
    grievance: Localized;
    statusTracking: Localized;
  };
  sources: { sourceId: string; section?: string }[];
  publicationDate?: string | null;
  effectiveFrom: string;
  reviewBy?: string | null;
  curator: string;
  dataConfidence: "high" | "medium" | "low";
  coverageFlags: string[];
  faqs?: { q: Localized; a: Localized }[];
  highImpact?: boolean;
  /** Whether the benefit goes to one person or the whole household (household benefits are counted once). */
  beneficiaryUnit?: "individual" | "household";
}

/** A test case: facts given as plain values (user_entered) or explicit records. */
export interface TestCaseSpec {
  name: string;
  kind:
    | "eligible"
    | "ineligible"
    | "boundary_age"
    | "boundary_income"
    | "missing_document"
    | "conflicting_document"
    | "expired_deadline"
    | "state_mismatch"
    | "other";
  facts: Record<string, FactValue | { value: FactValue; provenance: Provenance }[]>;
  documents?: string[];
  now?: string;
  deadlineOverride?: string;
  expected: string;
  /** For missing_document cases: at least one required document must be reported missing. */
  expectMissingDocs?: boolean;
}

export interface SchemeSeed {
  content: SchemeContent;
  tests: TestCaseSpec[];
}
