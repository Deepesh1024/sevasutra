// Redaction used before anything is logged, audited or stored from free text (chat, feedback).
// Never log OTP values, tokens, Aadhaar numbers, bank account numbers or document contents.

const PATTERNS: [RegExp, string][] = [
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[aadhaar-like number removed]"],
  [/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, "[phone removed]"],
  [/\b\d{9,18}\b/g, "[account-like number removed]"],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN removed]"],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[IFSC removed]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email removed]"],
  [/\b(otp|pin|password|passcode|cvv)\b[^\n]{0,20}?\b\d{4,8}\b/gi, "$1 [code removed]"],
];

export function redactText(s: string): string {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

/** True when the text looks like it contains a secret the user should not share. */
export function containsSecret(s: string): { found: boolean; kinds: string[] } {
  const kinds: string[] = [];
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(s)) kinds.push("aadhaar");
  if (/\b(otp|one[- ]time)\b/i.test(s) && /\b\d{4,8}\b/.test(s)) kinds.push("otp");
  if (/\b(password|passcode|pin|cvv|upi pin)\b/i.test(s)) kinds.push("password");
  if (/\b\d{9,18}\b/.test(s) && /\b(account|a\/c|acct|bank)\b/i.test(s)) kinds.push("bank_account");
  return { found: kinds.length > 0, kinds };
}

const SENSITIVE_KEYS = /otp|code|token|secret|password|aadhaar|account|ifsc|pan|content|cookie|authorization/i;

export function redactObject(v: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (typeof v === "string") return redactText(v);
  if (Array.isArray(v)) return v.map((x) => redactObject(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : redactObject(val, depth + 1);
    return out;
  }
  return v;
}

export function maskPhone(e164: string): string {
  return e164.replace(/^(\+91)(\d{2})\d{4}(\d{4})$/, "$1 $2xxxx$3");
}
