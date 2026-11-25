// Candidate-field extraction from pasted guideline text. Output is a SUGGESTION for curators;
// nothing extracted here is published without a human editing the draft and passing regression tests.

export interface Candidate { field: string; value: string; evidence: string }

const MONEY = /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore)?/gi;

function toNumber(raw: string, unit?: string) {
  const n = Number(raw.replace(/,/g, ""));
  if (!unit) return n;
  return /crore/i.test(unit) ? n * 1e7 : n * 1e5;
}

function around(text: string, idx: number, len: number) {
  return text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + len + 80)).replace(/\s+/g, " ").trim();
}

export function extractCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(/(?:aged?|age (?:limit|group)?|between)\s*(?:of\s*)?(\d{1,2})\s*(?:-|to|and)\s*(\d{1,3})\s*years?/gi)) {
    out.push({ field: "rule: age between", value: `[${m[1]}, ${m[2]}]`, evidence: around(text, m.index!, m[0].length) });
  }
  for (const m of text.matchAll(/(?:above|at least|minimum(?: age)? of|not less than)\s*(\d{1,2})\s*years?/gi)) {
    out.push({ field: "rule: age gte", value: m[1], evidence: around(text, m.index!, m[0].length) });
  }
  for (const m of text.matchAll(/(?:below|under|less than|not more than|up to|upto|maximum(?: age)? of)\s*(\d{1,2})\s*years?/gi)) {
    out.push({ field: "rule: age lte/lt", value: m[1], evidence: around(text, m.index!, m[0].length) });
  }
  for (const m of text.matchAll(MONEY)) {
    const ev = around(text, m.index!, m[0].length);
    const amount = toNumber(m[1], m[2]);
    const field = /income/i.test(ev) ? "rule: annual_family_income lte" : /per (month|mensem)|monthly/i.test(ev) ? "benefit: monthly amount" : /per (annum|year)|annual/i.test(ev) ? "benefit: annual amount" : "amount (classify)";
    out.push({ field, value: String(amount), evidence: ev });
  }
  for (const m of text.matchAll(/(?:last date|deadline|closing date)[^\d]{0,30}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/gi)) {
    out.push({ field: "application.deadline", value: m[1], evidence: around(text, m.index!, m[0].length) });
  }
  for (const m of text.matchAll(/https?:\/\/[^\s)"'<>]+/g)) out.push({ field: "source / application URL", value: m[0], evidence: around(text, m.index!, m[0].length) });
  for (const m of text.matchAll(/\b(scheduled caste|scheduled tribe|SC\/ST|OBC|EWS|minority|BPL|widow|girl|women|disabilit\w+|farmer|student)s?\b/gi)) {
    out.push({ field: "target group / category condition", value: m[1], evidence: around(text, m.index!, m[0].length) });
  }
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.field + c.value) ? false : (seen.add(c.field + c.value), true))).slice(0, 60);
}
