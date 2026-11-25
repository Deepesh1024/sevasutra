// Pure decision logic for document verification (unit-tested; no I/O).
import { z } from "zod";
import { DOC_TYPES } from "./types";

const KEYWORDS: Record<string, RegExp[]> = {
  aadhaar: [/aadhaar|aadhar/i, /आधार/, /unique identification authority/i, /\buidai\b/i, /\b\d{4}\s\d{4}\s\d{4}\b/],
  identity_proof: [/election commission|elector/i, /income tax department|permanent account number/i, /\bpassport\b/i, /driving licen[cs]e/i, /मतदाता|निर्वाचन/],
  income_certificate: [/income certificate/i, /आय प्रमाण/, /annual income|income from all sources/i, /वार्षिक आय/],
  caste_certificate: [/caste certificate|community certificate/i, /scheduled (caste|tribe)/i, /other backward class/i, /जाति प्रमाण/],
  domicile_certificate: [/domicile/i, /residence certificate|resident of/i, /निवास प्रमाण|मूल निवास/],
  disability_certificate: [/disabilit/i, /\budid\b/i, /दिव्यांग|विकलांग/, /locomotor|visual impairment|hearing impairment/i],
  bank_passbook: [/passbook/i, /\bifsc\b/i, /account (no|number)/i, /\bbranch\b/i, /savings bank/i],
  marksheet: [/marks|mark sheet|marksheet/i, /statement of (marks|grades)/i, /examination/i, /roll no/i, /अंक/],
  admission_proof: [/admission/i, /fee receipt/i, /bona ?fide/i, /college|university|institute/i],
  land_record: [/khatauni|khasra|jamabandi/i, /record of rights/i, /खतौनी|खसरा/, /\b7\/12\b|satbara|patta/i],
  ration_card: [/ration card/i, /राशन/, /food.*civil supplies/i, /antyodaya|priority household/i],
  birth_certificate: [/birth certificate/i, /जन्म प्रमाण/, /registration of births/i],
  mcp_card: [/mother and child protection|\bmcp\b/i, /immuni[sz]ation/i, /antenatal|\banc\b/i, /मातृ/],
  vending_certificate: [/vending/i, /street vendor/i, /town vending committee/i, /letter of recommendation/i],
  business_plan: [/project report|business plan/i, /cost of (the )?project/i, /means of finance/i],
  age_proof: [/date of birth|\bd\.?o\.?b\b/i, /birth certificate/i, /school leaving|transfer certificate/i, /जन्म तिथि/],
};

/** Keyword hit count per document type, computed locally on the raw OCR text. */
export function keywordScores(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [t, res] of Object.entries(KEYWORDS)) out[t] = res.filter((re) => re.test(text)).length;
  return out;
}

const TYPES = [...DOC_TYPES.map((d) => d.type), "other", "unreadable"] as const;

const LlmSchema = z.object({
  detected_type: z.string(),
  matches_declared: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(400).default(""),
  suspicious_instructions: z.boolean().optional().default(false),
  fields: z.object({
    annual_family_income: z.number().nullable().optional(),
    disability_percent: z.number().nullable().optional(),
    issue_date: z.string().nullable().optional(),
  }).partial().optional(),
});
export type LlmVerdict = z.infer<typeof LlmSchema>;

export function parseLlmVerdict(raw: string): LlmVerdict | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = LlmSchema.parse(JSON.parse(m[0]));
    if (!(TYPES as readonly string[]).includes(v.detected_type)) return { ...v, detected_type: "other" };
    return v;
  } catch {
    return null;
  }
}

/** Types that also satisfy a declared type (e.g. an Aadhaar is acceptable age proof). */
const ACCEPTS: Record<string, string[]> = {
  age_proof: ["age_proof", "birth_certificate", "aadhaar", "identity_proof", "marksheet"],
};

export interface Verdict {
  accept: boolean;
  status: "verified" | "unverified" | "rejected";
  confidence: number | null;
  reason: string;
  detectedType: string;
}

const label = (t: string) => (DOC_TYPES.find((d) => d.type === t)?.label.en ?? t.replace(/_/g, " ")).replace(/\s*\(.*\)$/, "").toLowerCase();
const a = (t: string) => `${/^[aeiou]/i.test(label(t)) ? "an" : "a"} ${label(t)}`;

/**
 * Vision fallback (OCR failed or read too little): the model looked at the image itself. Without a reliable
 * local cross-check the bar is higher: confidence ≥ 0.75 (or ≥ 0.6 if any OCR keyword agrees).
 */
function decideVision(declaredType: string, accepted: string[], llm: LlmVerdict | null, kwHits: number): Verdict {
  if (!llm) {
    return { accept: false, status: "rejected", confidence: null, detectedType: "unreadable", reason: "We couldn't read or check this file. Please upload a clearer, well-lit photo or the original PDF." };
  }
  if (llm.suspicious_instructions) {
    return { accept: false, status: "rejected", confidence: null, detectedType: "other", reason: "This file contains unusual text and could not be verified. Please upload the original document." };
  }
  if (llm.detected_type === "unreadable") {
    return { accept: false, status: "rejected", confidence: llm.confidence, detectedType: "unreadable", reason: "The document is too blurry or dark to read. Please upload a clearer photo or the original PDF." };
  }
  const bar = kwHits >= 1 ? 0.6 : 0.75;
  if (accepted.includes(llm.detected_type) && llm.matches_declared && llm.confidence >= bar) {
    return { accept: true, status: "verified", confidence: llm.confidence, detectedType: llm.detected_type, reason: llm.reason || `Looks like ${a(declaredType)}.` };
  }
  const looksLike = llm.detected_type !== "other" && !accepted.includes(llm.detected_type) ? ` It looks like ${a(llm.detected_type)}.` : "";
  return { accept: false, status: "rejected", confidence: llm.confidence, detectedType: llm.detected_type, reason: `This doesn't appear to be ${a(declaredType)}.${looksLike} Please choose the right document type or upload the correct file.` };
}

/**
 * Decision rules:
 * - Too little text → reject (cannot verify).
 * - Instruction-like text inside the document, or the LLM flags it → reject.
 * - With an LLM verdict: accept only if it matches the declared type with confidence ≥ 0.6 AND (local keywords
 *   agree, or LLM confidence ≥ 0.85). Otherwise reject, naming what it looks like instead.
 * - Without an LLM (no key / error): accept only on ≥ 2 keyword hits for the declared type.
 */
export function decideVerification(i: { declaredType: string; text: string; keyword: Record<string, number>; llm: LlmVerdict | null; injection: boolean; source?: "text" | "vision" }): Verdict {
  const accepted = ACCEPTS[i.declaredType] ?? [i.declaredType];
  const kwHits = Math.max(0, ...accepted.map((t) => i.keyword[t] ?? 0));
  if (i.source === "vision") return decideVision(i.declaredType, accepted, i.llm, kwHits);
  if (i.text.replace(/\s+/g, "").length < 20) {
    return { accept: false, status: "rejected", confidence: null, detectedType: "unreadable", reason: "We couldn't read enough text in this file to check it. Please upload a clearer, well-lit photo or the original PDF." };
  }
  if (i.injection || i.llm?.suspicious_instructions) {
    return { accept: false, status: "rejected", confidence: null, detectedType: "other", reason: "This file contains unusual text and could not be verified. Please upload the original document." };
  }
  if (i.llm) {
    const ok = accepted.includes(i.llm.detected_type) && i.llm.matches_declared && i.llm.confidence >= 0.6 && (kwHits >= 1 || i.llm.confidence >= 0.85);
    if (ok) return { accept: true, status: "verified", confidence: i.llm.confidence, detectedType: i.llm.detected_type, reason: i.llm.reason || `Looks like ${a(i.declaredType)}.` };
    const looksLike = i.llm.detected_type !== "other" && i.llm.detected_type !== "unreadable" && !accepted.includes(i.llm.detected_type) ? ` It looks like ${a(i.llm.detected_type)}.` : "";
    return { accept: false, status: "rejected", confidence: i.llm.confidence, detectedType: i.llm.detected_type, reason: `This doesn't appear to be ${a(i.declaredType)}.${looksLike} Please choose the right document type or upload the correct file.` };
  }
  if (kwHits >= 2) return { accept: true, status: "verified", confidence: null, detectedType: i.declaredType, reason: `Matched the wording of ${a(i.declaredType)} (automatic check without AI).` };
  const best = Object.entries(i.keyword).sort((a, b) => b[1] - a[1])[0];
  const looksLike = best && best[1] >= 2 && !accepted.includes(best[0]) ? ` It looks like ${a(best[0])}.` : "";
  return { accept: false, status: "rejected", confidence: null, detectedType: best?.[1] ? best[0] : "other", reason: `We couldn't confirm this is ${a(i.declaredType)}.${looksLike} Please upload the correct document.` };
}
