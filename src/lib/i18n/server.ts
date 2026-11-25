import "server-only";
import { cookies } from "next/headers";
import { translate, type DictKey, type Lang } from "./dict";
import type { Localized } from "@/lib/engine/types";

export const LANG_COOKIE = "sh_lang";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "hi" ? "hi" : "en";
}

export async function getT() {
  const lang = await getLang();
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  /** Pick a localized content string; `fallback` tells the UI it fell back to English. */
  const L = (l: Localized | undefined) => (l ? (lang === "hi" ? l.hi ?? l.en : l.en) : "");
  const hasTranslation = (l: Localized | undefined) => lang === "en" || !!l?.hi;
  return { lang, t, L, hasTranslation };
}
