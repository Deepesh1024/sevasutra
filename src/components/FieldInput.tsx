import type { FieldDef } from "@/lib/profile/fields";
import type { FactValue } from "@/lib/engine/types";
import { translate, type Lang } from "@/lib/i18n/dict";
import { pickL } from "./ui";

/** Accessible input for a typed profile field. Works in plain HTML forms (no JS required). */
export function FieldInput({ field, value, lang, idPrefix = "f", disabled }: { field: FieldDef; value?: FactValue; lang: Lang; idPrefix?: string; disabled?: boolean }) {
  const id = `${idPrefix}-${field.key}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const label = pickL(field.label, lang);
  const t = (k: string) => translate(lang, k as never);
  const str = value === undefined || value === null ? "" : typeof value === "object" && !Array.isArray(value) ? "" : String(value);

  if (field.type === "boolean") {
    const opts: [string, string][] = [["true", t("profile.yes")], ["false", t("profile.no")], ["not_sure", t("profile.notSure")]];
    if (field.allowDecline) opts.push(["prefer_not_to_say", t("profile.declined")]);
    return (
      <fieldset className="field" disabled={disabled} aria-describedby={helpId}>
        <legend className="label">{label}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {opts.map(([v, l]) => (
            <label key={v} className="inline-flex items-center gap-2 min-h-[44px] font-normal">
              <input type="radio" name={field.key} value={v} defaultChecked={str === v} className="w-5 h-5" />
              {l}
            </label>
          ))}
        </div>
        {field.help && <p id={helpId} className="help">{pickL(field.help, lang)}</p>}
      </fieldset>
    );
  }

  if (field.type === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <fieldset className="field" disabled={disabled}>
        <legend className="label">{label}</legend>
        <input type="hidden" name={`${field.key}__present`} value="1" />
        <div className="grid sm:grid-cols-2 gap-x-4">
          {field.options!.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-2 min-h-[40px] font-normal">
              <input type="checkbox" name={field.key} value={o.value} defaultChecked={arr.includes(o.value)} className="w-5 h-5" />
              {pickL(o.label, lang)}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {field.type === "select" ? (
        <select id={id} name={field.key} defaultValue={str} disabled={disabled} aria-describedby={helpId}>
          <option value="">—</option>
          {field.options!.map((o) => (
            <option key={o.value} value={o.value}>{pickL(o.label, lang)}</option>
          ))}
          {field.allowDecline && <option value="prefer_not_to_say">{t("profile.declined")}</option>}
        </select>
      ) : field.type === "date" ? (
        <input id={id} name={field.key} type="date" defaultValue={str} disabled={disabled} aria-describedby={helpId} max={new Date().toISOString().slice(0, 10)} />
      ) : field.type === "number" || field.type === "money" ? (
        <div className="flex items-center gap-2">
          {field.type === "money" && <span aria-hidden className="text-ink-2">₹</span>}
          <input id={id} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step={1} defaultValue={str === "prefer_not_to_say" ? "" : str} disabled={disabled} aria-describedby={helpId} />
          {field.allowDecline && (
            <label className="inline-flex items-center gap-1 text-sm whitespace-nowrap font-normal">
              <input type="checkbox" name={field.key} value="prefer_not_to_say" defaultChecked={str === "prefer_not_to_say"} className="w-4 h-4" />
              {t("profile.declined")}
            </label>
          )}
        </div>
      ) : (
        <input id={id} name={field.key} type="text" maxLength={100} defaultValue={str} disabled={disabled} aria-describedby={helpId} />
      )}
      {field.help && <p id={helpId} className="help mt-1">{pickL(field.help, lang)}</p>}
    </div>
  );
}

/** Read field values from FormData (handles the decline checkbox and multiselect). */
export function readFieldForm(fd: FormData, keys: string[]): Record<string, string | string[] | null> {
  const out: Record<string, string | string[] | null> = {};
  for (const k of keys) {
    const all = fd.getAll(k).map(String);
    if (fd.get(`${k}__present`)) out[k] = all;
    else if (all.includes("prefer_not_to_say")) out[k] = "prefer_not_to_say";
    else out[k] = all.length ? all[0] : null;
  }
  return out;
}
