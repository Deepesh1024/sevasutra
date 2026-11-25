"use server";

import { evaluate } from "@/lib/engine/evaluate";
import type { EligibilityStatus, FactInput } from "@/lib/engine/types";
import { FIELD_MAP } from "@/lib/profile/fields";
import { parseFieldValue } from "@/lib/profile/service";
import { readFieldForm } from "@/components/FieldInput";
import { contentOf, evaluable, listPublished } from "@/lib/schemes/repo";
import { clientIpHash } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { getLang } from "@/lib/i18n/server";

export type DiscoveryState = { rows?: { schemeId: string; name: string; status: EligibilityStatus }[]; error?: string; values?: Record<string, unknown> };

/** Guest discovery across all schemes. Answers are used for this request only and never stored. */
export async function discoveryCheckAction(_p: DiscoveryState, fd: FormData): Promise<DiscoveryState> {
  if (!(await rateLimit(`discovery:${await clientIpHash()}`, 30, 3600))) return { error: "Too many checks. Try later." };
  const lang = await getLang();
  const keys = String(fd.get("keys") ?? "").split(",").filter((k) => FIELD_MAP[k]);
  const raw = readFieldForm(fd, keys);
  const input: FactInput = {};
  for (const k of keys) {
    const v = parseFieldValue(FIELD_MAP[k], raw[k]);
    if (v !== undefined) input[k] = [{ key: k, value: v, provenance: "user_entered" }];
  }
  const schemes = await listPublished();
  return {
    values: Object.fromEntries(Object.entries(input).map(([k, r]) => [k, r[0].value])),
    rows: schemes.map((s) => ({ schemeId: s.schemeId, name: lang === "hi" ? contentOf(s).name.hi ?? s.name : s.name, status: evaluate(evaluable(s), input).status })),
  };
}
