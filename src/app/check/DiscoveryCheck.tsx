"use client";

import { useActionState } from "react";
import Link from "next/link";
import { discoveryCheckAction, type DiscoveryState } from "@/app/actions/discovery";
import { FieldInput } from "@/components/FieldInput";
import { StatusBadge } from "@/components/ui";
import { FIELD_MAP } from "@/lib/profile/fields";
import type { Lang } from "@/lib/i18n/dict";

export function DiscoveryCheck({ keys, lang }: { keys: string[]; lang: Lang }) {
  const [state, action, pending] = useActionState<DiscoveryState, FormData>(discoveryCheckAction, {});
  const hi = lang === "hi";
  const order = ["eligible", "partially_eligible", "needs_manual_review", "not_eligible", "expired_or_closed"];
  return (
    <div className="space-y-4">
      <form action={action} className="card p-4 space-y-3">
        <input type="hidden" name="keys" value={keys.join(",")} />
        <div className="grid gap-3 md:grid-cols-2">{keys.map((k) => FIELD_MAP[k] && <FieldInput key={`${k}:${JSON.stringify(state.values?.[k] ?? "")}`} field={FIELD_MAP[k]} lang={lang} idPrefix="dc" value={state.values?.[k] as never} />)}</div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "…" : hi ? "योजनाएँ दिखाएँ" : "Show schemes"}</button>
      </form>
      {state.rows && (
        <section aria-live="polite" className="card p-4">
          <h2 className="font-bold text-lg mb-2">{hi ? "परिणाम" : "Results"}</h2>
          <ul className="divide-y divide-line">
            {[...state.rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).map((r) => (
              <li key={r.schemeId} className="py-2 flex flex-wrap justify-between gap-2 items-center">
                <Link href={`/schemes/${r.schemeId}`}>{r.name}</Link>
                <StatusBadge status={r.status} lang={lang} />
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-2 mt-2">{hi ? "“संभवतः पात्र (जानकारी बाकी)” का अर्थ है कि योजना कुछ और प्रश्न पूछती है। यह आधिकारिक निर्णय नहीं है।" : "“Possibly eligible” means the scheme needs a few more answers. These are not official decisions."}</p>
        </section>
      )}
    </div>
  );
}
