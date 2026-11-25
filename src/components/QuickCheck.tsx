"use client";

import { useActionState } from "react";
import { quickCheckAction, type QuickCheckState } from "@/app/actions/schemes";
import { FieldInput } from "./FieldInput";
import { EligibilityResultView } from "./EligibilityResultView";
import { FIELD_MAP } from "@/lib/profile/fields";
import { translate, type Lang } from "@/lib/i18n/dict";

export function QuickCheck({ schemeId, keys, lang, meta }: { schemeId: string; keys: string[]; lang: Lang; meta: Parameters<typeof EligibilityResultView>[0]["meta"] }) {
  const [state, action, pending] = useActionState<QuickCheckState, FormData>(quickCheckAction, {});
  const t = (k: string) => translate(lang, k as never);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="schemeId" value={schemeId} />
        <input type="hidden" name="keys" value={keys.join(",")} />
        <p className="help">{t("elig.answerHint")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {keys.map((k) => FIELD_MAP[k] && <FieldInput key={`${k}:${JSON.stringify(state.values?.[k] ?? "")}`} field={FIELD_MAP[k]} lang={lang} idPrefix="qc" value={state.values?.[k] as never} />)}
        </div>
        <button className="btn btn-primary" disabled={pending}>{pending ? "…" : t("elig.check")}</button>
      </form>
      {state.error && <p role="alert" className="text-bad">{state.error}</p>}
      {state.result && <EligibilityResultView result={state.result} lang={lang} meta={meta} />}
    </div>
  );
}
