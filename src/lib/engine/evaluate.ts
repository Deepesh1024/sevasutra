import { createHash } from "crypto";
import { buildFacts, resolveReferenceDate, type ResolvedFact, type ResolvedFacts } from "./facts";
import type {
  BenefitEstimate,
  BenefitSpec,
  DocLeaf,
  DocumentCheck,
  DocumentRequirement,
  EligibilityStatus,
  EvaluationResult,
  FactInput,
  FactLeaf,
  FactValue,
  Interval,
  LeafOutcome,
  LeafResult,
  Localized,
  RuleDefinition,
  RuleNode,
} from "./types";
import { FIELD_MAP, factLabel, optionLabel } from "@/lib/profile/fields";
import { docLabel } from "@/lib/documents/types";

export const ENGINE_VERSION = "1.0.0";

/** Three-valued logic plus conflict. */
type V = "T" | "F" | "U" | "C";
interface NodeEval {
  v: V;
  /** True when the node is T only because of unverified (user-entered) facts that require verification. */
  unverified: boolean;
  leafIds: string[];
}

export interface SchemeForEvaluation {
  id: string;
  lifecycleStatus: string; // open | closed | upcoming | discontinued
  deadline?: string | null;
  opensAt?: string | null;
  rule: RuleDefinition;
  ruleEffectiveFrom?: string | null;
  ruleEffectiveUntil?: string | null;
  documents: DocumentRequirement[];
  benefit?: BenefitSpec;
  stateScope?: string[]; // empty = all India
}

export interface EvaluateOptions {
  now?: Date;
  /** Document types the user has in the vault (active, not expired, scanned clean). */
  documents?: string[];
}

const isFactLeaf = (n: RuleNode): n is FactLeaf => (n as FactLeaf).fact !== undefined;
const isDocLeaf = (n: RuleNode): n is DocLeaf => (n as DocLeaf).doc !== undefined;

export function hashRule(rule: unknown): string {
  return createHash("sha256").update(stableStringify(rule)).digest("hex").slice(0, 16);
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

// ───────────── formatting ─────────────

import { rupees } from "@/lib/format";
export { rupees };

const MONEY_FACTS = new Set(["annual_family_income", "monthly_pension"]);

function fmtValue(fact: string, v: unknown, lang: "en" | "hi"): string {
  if (v === null || v === undefined) return lang === "hi" ? "अज्ञात" : "unknown";
  if (typeof v === "boolean") return v ? (lang === "hi" ? "हाँ" : "yes") : lang === "hi" ? "नहीं" : "no";
  if (typeof v === "number") return MONEY_FACTS.has(fact) ? rupees(v) : String(v);
  if (Array.isArray(v)) return v.map((x) => fmtValue(fact, x, lang)).join(", ");
  if (typeof v === "object") {
    const iv = v as Interval;
    const f = (n?: number) => (n === undefined ? "…" : MONEY_FACTS.has(fact) ? rupees(n) : String(n));
    return `${f(iv.min)}–${f(iv.max)}`;
  }
  const ol = optionLabel(fact, String(v));
  return ol ? (lang === "hi" ? ol.hi ?? ol.en : ol.en) : String(v);
}

const loc = (en: string, hi: string): Localized => ({ en, hi });
const pick = (l: Localized, lang: "en" | "hi") => (lang === "hi" ? l.hi ?? l.en : l.en);

// ───────────── leaf evaluation ─────────────

function cmpInterval(iv: Interval, op: string, target: number | [number, number]): V {
  const lo = iv.min ?? -Infinity;
  const hi = iv.max ?? Infinity;
  switch (op) {
    case "gte": return lo >= (target as number) ? "T" : hi < (target as number) ? "F" : "U";
    case "gt": return lo > (target as number) ? "T" : hi <= (target as number) ? "F" : "U";
    case "lte": return hi <= (target as number) ? "T" : lo > (target as number) ? "F" : "U";
    case "lt": return hi < (target as number) ? "T" : lo >= (target as number) ? "F" : "U";
    case "between": {
      const [a, b] = target as [number, number];
      if (lo >= a && hi <= b) return "T";
      if (hi < a || lo > b) return "F";
      return "U";
    }
    case "eq": return lo === hi && lo === target ? "T" : (target as number) < lo || (target as number) > hi ? "F" : "U";
    default: return "U";
  }
}

function compare(actual: FactValue, op: FactLeaf["op"], expected: FactLeaf["value"]): V {
  switch (op) {
    case "exists": return "T";
    case "is_true": return actual === true ? "T" : actual === false ? "F" : "U";
    case "is_false": return actual === false ? "T" : actual === true ? "F" : "U";
    case "eq": if (actual && typeof actual === "object" && !Array.isArray(actual)) return cmpInterval(actual as Interval, op, expected as number);
      return actual === expected ? "T" : "F";
    case "neq": return actual === expected ? "F" : "T";
    case "in": return (expected as FactValue[]).includes(actual as never) ? "T" : "F";
    case "not_in": return (expected as FactValue[]).includes(actual as never) ? "F" : "T";
    case "contains": return Array.isArray(actual) ? (actual.includes(expected as string) ? "T" : "F") : "U";
    case "not_contains": return Array.isArray(actual) ? (actual.includes(expected as string) ? "F" : "T") : "U";
    case "gte": case "gt": case "lte": case "lt": case "between": {
      if (typeof actual === "number") {
        const t = expected as number;
        if (op === "gte") return actual >= t ? "T" : "F";
        if (op === "gt") return actual > t ? "T" : "F";
        if (op === "lte") return actual <= t ? "T" : "F";
        if (op === "lt") return actual < t ? "T" : "F";
        const [a, b] = expected as [number, number];
        return actual >= a && actual <= b ? "T" : "F";
      }
      if (actual && typeof actual === "object" && !Array.isArray(actual)) return cmpInterval(actual as Interval, op, expected as number | [number, number]);
      return "U";
    }
  }
}

const SENSITIVE_EXPLAIN = (fact: string) => FIELD_MAP[fact]?.sensitive === true;

function explainFactLeaf(leaf: FactLeaf, f: ResolvedFact, outcome: LeafOutcome): Localized {
  const fl = factLabel(leaf.fact);
  const label = leaf.label;
  const sensitive = SENSITIVE_EXPLAIN(leaf.fact);
  const actualEn = f.state === "known" ? (sensitive ? "the information you provided" : fmtValue(leaf.fact, f.value, "en")) : "";
  const actualHi = f.state === "known" ? (sensitive ? "आपके द्वारा दी गई जानकारी" : fmtValue(leaf.fact, f.value, "hi")) : "";
  switch (outcome) {
    case "pass":
      return loc(`Met: ${label.en} (based on ${actualEn}).`, `पूरा: ${pick(label, "hi")} (${actualHi} के आधार पर)।`);
    case "fail":
      return loc(
        `Not met: ${label.en}. Based on ${actualEn}, this condition is not satisfied.`,
        `पूरा नहीं: ${pick(label, "hi")}। ${actualHi} के आधार पर यह शर्त पूरी नहीं होती।`,
      );
    case "unverified":
      return loc(
        `Likely met but not yet verified: ${label.en}. The scheme checks this against a document.`,
        `संभवतः पूरा, पर सत्यापित नहीं: ${pick(label, "hi")}। योजना इसे दस्तावेज़ से जाँचती है।`,
      );
    case "declined":
      return loc(
        `You chose not to share "${fl.en}", so this condition cannot be checked.`,
        `आपने "${pick(fl, "hi")}" साझा नहीं करना चुना, इसलिए यह शर्त जाँची नहीं जा सकती।`,
      );
    case "conflict":
      return loc(
        `Your profile has different values for "${fl.en}" from different sources, so this needs review.`,
        `आपकी प्रोफ़ाइल में "${pick(fl, "hi")}" के लिए अलग-अलग स्रोतों से भिन्न मान हैं, इसलिए समीक्षा आवश्यक है।`,
      );
    default:
      if (f.state === "known") {
        return loc(
          `Can't tell yet: ${label.en}. The range you gave (${actualEn}) is on both sides of the limit.`,
          `अभी तय नहीं: ${pick(label, "hi")}। आपके द्वारा दिया गया दायरा (${actualHi}) सीमा के दोनों ओर है।`,
        );
      }
      return loc(`Information needed: ${fl.en}.`, `जानकारी आवश्यक: ${pick(fl, "hi")}।`);
  }
}

interface Ctx {
  facts: ResolvedFacts;
  docs: Set<string>;
  leaves: Map<string, LeafResult>;
}

function evalNode(node: RuleNode, ctx: Ctx): NodeEval {
  if (isDocLeaf(node)) {
    const present = ctx.docs.has(node.doc);
    const outcome: LeafOutcome = present ? "pass" : "unknown";
    ctx.leaves.set(node.id, {
      id: node.id, kind: "document", doc: node.doc, op: "present", outcome, label: node.label, decisive: false,
      explanation: present
        ? loc(`Document available: ${docLabel(node.doc).en}.`, `दस्तावेज़ उपलब्ध: ${pick(docLabel(node.doc), "hi")}।`)
        : loc(`Document needed: ${docLabel(node.doc).en}.`, `दस्तावेज़ आवश्यक: ${pick(docLabel(node.doc), "hi")}।`),
      changeHint: node.changeHint ?? loc(`Add your ${docLabel(node.doc).en} to the document vault.`, `अपना ${pick(docLabel(node.doc), "hi")} दस्तावेज़ तिजोरी में जोड़ें।`),
    });
    return { v: present ? "T" : "U", unverified: false, leafIds: [node.id] };
  }
  if (isFactLeaf(node)) {
    const f = ctx.facts[node.fact] ?? { state: "missing" };
    let v: V;
    let outcome: LeafOutcome;
    let unverified = false;
    if (f.state === "missing") { v = "U"; outcome = "unknown"; }
    else if (f.state === "declined") { v = "U"; outcome = "declined"; }
    else if (f.state === "conflict") { v = "C"; outcome = "conflict"; }
    else {
      v = compare(f.value, node.op, node.value);
      outcome = v === "T" ? "pass" : v === "F" ? "fail" : "unknown";
      if (v === "T" && node.requireVerified && !f.verified) { unverified = true; outcome = "unverified"; }
    }
    ctx.leaves.set(node.id, {
      id: node.id, kind: "fact", fact: node.fact, op: node.op, expected: node.value,
      actual: f.state === "known" ? (SENSITIVE_EXPLAIN(node.fact) ? "[provided]" : f.value) : undefined,
      provenance: f.state === "known" ? f.provenance : undefined,
      outcome, label: node.label, explanation: explainFactLeaf(node, f, outcome), changeHint: node.changeHint, decisive: false,
    });
    return { v, unverified, leafIds: [node.id] };
  }
  if ("all" in node) {
    const kids = node.all.map((k) => evalNode(k, ctx));
    const vs = kids.map((k) => k.v);
    const v: V = vs.includes("F") ? "F" : vs.includes("C") ? "C" : vs.includes("U") ? "U" : "T";
    // For a failed `all`, the decisive leaves are the failing children; otherwise all children matter.
    const decisiveKids = v === "F" ? kids.filter((k) => k.v === "F") : kids;
    return { v, unverified: kids.some((k) => k.unverified), leafIds: decisiveKids.flatMap((k) => k.leafIds) };
  }
  if ("any" in node) {
    const kids = node.any.map((k) => evalNode(k, ctx));
    const vs = kids.map((k) => k.v);
    const v: V = vs.includes("T") ? "T" : vs.includes("C") ? "C" : vs.includes("U") ? "U" : "F";
    const trueKids = kids.filter((k) => k.v === "T");
    const verifiedTrue = trueKids.find((k) => !k.unverified);
    let decisive: NodeEval[];
    if (v === "T") decisive = [verifiedTrue ?? trueKids[0]];
    else if (v === "F") decisive = kids;
    else decisive = kids.filter((k) => k.v !== "F");
    return { v, unverified: v === "T" && !verifiedTrue, leafIds: decisive.flatMap((k) => k.leafIds) };
  }
  const inner = evalNode(node.not, ctx);
  const v: V = inner.v === "T" ? "F" : inner.v === "F" ? "T" : inner.v;
  // Leaf outcomes describe the leaf's own condition. Under `not`, the outcome as seen by the user flips:
  // a leaf whose condition holds is what makes the negation fail.
  for (const id of leafIdsOf(node.not)) {
    const l = ctx.leaves.get(id);
    if (!l) continue;
    if (l.outcome === "pass" || l.outcome === "unverified") l.outcome = "fail";
    else if (l.outcome === "fail") l.outcome = "pass";
  }
  return { v, unverified: false, leafIds: inner.leafIds };
}

function leafIdsOf(node: RuleNode): string[] {
  if (isFactLeaf(node) || isDocLeaf(node)) return [node.id];
  if ("all" in node) return node.all.flatMap(leafIdsOf);
  if ("any" in node) return node.any.flatMap(leafIdsOf);
  return leafIdsOf(node.not);
}

function relabelNegations(node: RuleNode, ctx: Ctx) {
  // Exclusion leaves are written positively ("Pays income tax") and wrapped in `not`. Rewrite explanations
  // so users see "Exclusion does not apply: …" rather than a confusing double negative.
  if ("not" in node) {
    const walk = (n: RuleNode) => {
      if (isFactLeaf(n) || isDocLeaf(n)) {
        const l = ctx.leaves.get(n.id);
        if (!l) return;
        if (l.outcome === "pass") l.explanation = loc(`Exclusion does not apply: ${n.label.en}.`, `अपवर्जन लागू नहीं: ${pick(n.label, "hi")}।`);
        else if (l.outcome === "fail") l.explanation = loc(`Excluded: ${n.label.en}. The scheme does not cover people in this situation.`, `अपवर्जित: ${pick(n.label, "hi")}। यह योजना इस स्थिति वाले लोगों को शामिल नहीं करती।`);
        return;
      }
      if ("all" in n) n.all.forEach(walk);
      else if ("any" in n) n.any.forEach(walk);
      else walk(n.not);
    };
    walk(node.not);
    return;
  }
  if ("all" in node) node.all.forEach((n) => relabelNegations(n, ctx));
  else if ("any" in node) node.any.forEach((n) => relabelNegations(n, ctx));
}

// ───────────── documents & benefit ─────────────

function checkDocuments(reqs: DocumentRequirement[], ctx: Ctx): DocumentCheck[] {
  const out: DocumentCheck[] = [];
  for (const r of reqs) {
    if (r.onlyIf) {
      const scratch: Ctx = { ...ctx, leaves: new Map() };
      const res = evalNode(r.onlyIf, scratch);
      if (res.v === "F") continue;
    }
    const satisfiedBy = [r.type, ...(r.alternatives ?? [])].find((t) => ctx.docs.has(t));
    out.push({
      type: r.type, label: r.label, required: r.required, present: !!satisfiedBy, satisfiedBy,
      alternatives: (r.alternatives ?? []).map((t) => ({ type: t, label: docLabel(t) })),
      verification: r.verification,
    });
  }
  return out;
}

const PERIODS: Record<string, number> = { monthly: 12, annual: 1, one_time: 0, per_installment: 3, per_event: 0, on_maturity: 0 };

function estimateBenefit(spec: BenefitSpec, ctx: Ctx): BenefitEstimate {
  const calc: Localized[] = [];
  let amount: number | undefined;
  if (spec.tiers?.length) {
    for (const tier of spec.tiers) {
      const r = evalNode(tier.when, { ...ctx, leaves: new Map() });
      if (r.v === "T") {
        amount = tier.amount;
        calc.push(loc(`Tier applied: ${tier.label.en} → ${rupees(tier.amount)}.`, `लागू स्तर: ${pick(tier.label, "hi")} → ${rupees(tier.amount)}।`));
        break;
      }
    }
    if (amount === undefined) calc.push(loc("Not enough information to pick a benefit tier; showing the stated range.", "लाभ स्तर चुनने के लिए पर्याप्त जानकारी नहीं; बताई गई सीमा दिखाई जा रही है।"));
  } else if (spec.amountMin !== undefined && spec.amountMin === spec.amountMax) {
    amount = spec.amountMin;
  }
  let annualised: number | undefined;
  const per = spec.periodsPerYear ?? PERIODS[spec.frequency ?? "one_time"] ?? 0;
  const base = amount ?? spec.amountMax;
  if (spec.countsAsMoney && base !== undefined && per > 0) {
    annualised = base * per;
    if (per !== 1) calc.push(loc(`${rupees(base)} × ${per} per year = ${rupees(annualised)} per year (maximum, subject to scheme rules).`, `${rupees(base)} × ${per} प्रति वर्ष = ${rupees(annualised)} प्रति वर्ष (अधिकतम, योजना नियमों के अधीन)।`));
  }
  if (!spec.countsAsMoney) calc.push(loc("Not counted as money you receive (cover, credit, service or savings).", "आपको मिलने वाली राशि के रूप में नहीं गिना गया (बीमा, ऋण, सेवा या बचत)।"));
  calc.unshift(spec.basis);
  return {
    kind: spec.kind, amount, amountMin: spec.amountMin, amountMax: spec.amountMax, annualised, frequency: spec.frequency,
    stated: spec.stated && (amount !== undefined || spec.amountMin === spec.amountMax), countsAsMoney: spec.countsAsMoney,
    exclusivityGroup: spec.exclusivityGroup, basis: spec.basis, calculation: calc,
  };
}

// ───────────── main entry ─────────────

const HEADLINES: Record<EligibilityStatus, Localized> = {
  eligible: loc("Likely eligible based on the information provided", "दी गई जानकारी के आधार पर संभवतः पात्र"),
  partially_eligible: loc("Possibly eligible — some information still needs to be provided or verified", "संभवतः पात्र — कुछ जानकारी देनी या सत्यापित करनी बाकी है"),
  not_eligible: loc("Likely not eligible based on the information provided", "दी गई जानकारी के आधार पर संभवतः पात्र नहीं"),
  expired_or_closed: loc("Not accepting applications right now", "अभी आवेदन स्वीकार नहीं किए जा रहे"),
  needs_manual_review: loc("Needs review — the rules or your information are not clear enough to decide", "समीक्षा आवश्यक — नियम या जानकारी निर्णय के लिए पर्याप्त स्पष्ट नहीं"),
};

export const DISCLAIMER: Localized = loc(
  "This is an informational check by SevaSutra, not an official decision. The final decision rests with the scheme authority.",
  "यह सेवासूत्र द्वारा केवल जानकारी के लिए की गई जाँच है, आधिकारिक निर्णय नहीं। अंतिम निर्णय योजना प्राधिकरण का होता है।",
);

export function evaluate(scheme: SchemeForEvaluation, input: FactInput, opts: EvaluateOptions = {}): EvaluationResult {
  const now = opts.now ?? new Date();
  const ref = resolveReferenceDate(scheme.rule.referenceDate, now);
  const facts = buildFacts(input, ref);
  const ctx: Ctx = { facts, docs: new Set(opts.documents ?? []), leaves: new Map() };

  // State scope is a mandatory implicit condition for state schemes.
  let mandatory: RuleNode = scheme.rule.mandatory;
  if (scheme.stateScope && scheme.stateScope.length > 0) {
    mandatory = {
      all: [
        {
          id: "_state_scope", fact: "state", op: "in", value: scheme.stateScope,
          label: loc(`Lives in ${scheme.stateScope.join(", ")}`, `${scheme.stateScope.join(", ")} में निवास`),
          changeHint: loc("This scheme is only for residents of the listed state(s).", "यह योजना केवल सूचीबद्ध राज्य(यों) के निवासियों के लिए है।"),
        },
        mandatory,
      ],
    };
  }

  const main = evalNode(mandatory, ctx);
  relabelNegations(mandatory, ctx);
  for (const id of main.leafIds) {
    const l = ctx.leaves.get(id);
    if (l) l.decisive = true;
  }

  let status: EligibilityStatus;
  let exceptionApplied: EvaluationResult["exceptionApplied"];
  let manualReviewReason: Localized | undefined;
  let closedReason: Localized | undefined;

  for (const ex of [...(scheme.rule.exceptions ?? [])].sort((a, b) => a.priority - b.priority)) {
    const r = evalNode(ex.when, { ...ctx, leaves: new Map() });
    if (r.v === "T") {
      exceptionApplied = { id: ex.id, effect: ex.effect, explanation: ex.explanation };
      break;
    }
  }

  if (main.v === "F") status = "not_eligible";
  else if (main.v === "C") {
    status = "needs_manual_review";
    manualReviewReason = loc("Your profile has conflicting values for a required fact.", "किसी आवश्यक जानकारी के लिए आपकी प्रोफ़ाइल में परस्पर विरोधी मान हैं।");
  } else if (main.v === "U" || main.unverified) status = "partially_eligible";
  else status = "eligible";

  if (exceptionApplied) {
    status = exceptionApplied.effect as EligibilityStatus;
    if (status === "needs_manual_review") manualReviewReason = exceptionApplied.explanation;
  }

  if (scheme.rule.ambiguous && status !== "not_eligible") {
    status = "needs_manual_review";
    manualReviewReason = scheme.rule.ambiguous.note;
  }

  // Lifecycle / deadline / rule effective window — checked last so users still see the criteria breakdown.
  const deadline = scheme.deadline ? new Date(scheme.deadline) : null;
  if (scheme.lifecycleStatus === "closed" || scheme.lifecycleStatus === "discontinued") {
    status = "expired_or_closed";
    closedReason = loc("The scheme authority has closed or discontinued this scheme.", "योजना प्राधिकरण ने यह योजना बंद या समाप्त कर दी है।");
  } else if (deadline && deadline.getTime() < now.getTime()) {
    status = "expired_or_closed";
    closedReason = loc(`The application deadline (${deadline.toISOString().slice(0, 10)}) has passed.`, `आवेदन की अंतिम तिथि (${deadline.toISOString().slice(0, 10)}) बीत चुकी है।`);
  } else if (scheme.lifecycleStatus === "upcoming" || (scheme.opensAt && new Date(scheme.opensAt) > now)) {
    status = "expired_or_closed";
    closedReason = loc("Applications have not opened yet.", "आवेदन अभी शुरू नहीं हुए हैं।");
  } else if (scheme.ruleEffectiveUntil && new Date(scheme.ruleEffectiveUntil) < now) {
    status = "expired_or_closed";
    closedReason = loc("The guideline version on file has expired; awaiting an updated guideline.", "उपलब्ध दिशानिर्देश की अवधि समाप्त हो गई है; अद्यतन दिशानिर्देश की प्रतीक्षा है।");
  }

  const leaves = [...ctx.leaves.values()];
  const documents = checkDocuments(scheme.documents, ctx);

  const whatWouldChange: Localized[] = [];
  for (const l of leaves.filter((x) => x.decisive)) {
    if (l.outcome === "fail") {
      whatWouldChange.push(l.changeHint ?? loc(`This result would change if this were true: ${l.label.en}.`, `यदि यह सही होता तो परिणाम बदल सकता था: ${pick(l.label, "hi")}।`));
    } else if (l.outcome === "unknown" || l.outcome === "declined") {
      const fl = l.fact ? factLabel(l.fact) : docLabel(l.doc!);
      whatWouldChange.push(loc(`Add "${fl.en}" to your profile to get a clearer answer.`, `स्पष्ट उत्तर के लिए अपनी प्रोफ़ाइल में "${pick(fl, "hi")}" जोड़ें।`));
    } else if (l.outcome === "unverified") {
      whatWouldChange.push(loc(`Verifying "${factLabel(l.fact!).en}" with a document would confirm this condition.`, `"${pick(factLabel(l.fact!), "hi")}" को दस्तावेज़ से सत्यापित करने पर यह शर्त पुष्ट होगी।`));
    } else if (l.outcome === "conflict") {
      whatWouldChange.push(loc(`Correct the conflicting values for "${factLabel(l.fact!).en}" on your profile.`, `अपनी प्रोफ़ाइल में "${pick(factLabel(l.fact!), "hi")}" के परस्पर विरोधी मान ठीक करें।`));
    }
  }
  for (const d of documents.filter((x) => x.required && !x.present)) {
    whatWouldChange.push(loc(`Keep your ${d.label.en} ready — you will need it to apply.`, `अपना ${pick(d.label, "hi")} तैयार रखें — आवेदन के लिए आवश्यक होगा।`));
  }
  if (closedReason) whatWouldChange.unshift(loc("Save this scheme to be reminded when applications reopen.", "आवेदन फिर से खुलने पर याद दिलाने के लिए यह योजना सहेजें।"));

  return {
    engineVersion: ENGINE_VERSION,
    ruleHash: hashRule(scheme.rule),
    referenceDate: ref.toISOString().slice(0, 10),
    status,
    headline: HEADLINES[status],
    leaves,
    exceptionApplied,
    documents,
    benefit: scheme.benefit ? estimateBenefit(scheme.benefit, ctx) : undefined,
    whatWouldChange: dedupeLocalized(whatWouldChange),
    caveats: scheme.rule.caveats ?? [],
    closedReason,
    manualReviewReason,
    disclaimer: DISCLAIMER,
  };
}

function dedupeLocalized(xs: Localized[]): Localized[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.en) ? false : (seen.add(x.en), true)));
}

/** List the facts a rule references — used for progressive "ask only what's needed" questions. */
export function factsReferenced(node: RuleNode, acc = new Set<string>()): Set<string> {
  if (isFactLeaf(node)) {
    acc.add(node.fact === "age" ? "date_of_birth" : node.fact);
  } else if (isDocLeaf(node)) {
    /* documents handled separately */
  } else if ("all" in node) node.all.forEach((n) => factsReferenced(n, acc));
  else if ("any" in node) node.any.forEach((n) => factsReferenced(n, acc));
  else factsReferenced(node.not, acc);
  return acc;
}
