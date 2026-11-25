"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const YEAR = 365 * 86400;

export async function setLang(formData: FormData) {
  const lang = formData.get("lang") === "hi" ? "hi" : "en";
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const u = await currentUser();
  if (u) await db.user.update({ where: { id: u.id }, data: { locale: lang } });
  revalidatePath("/", "layout");
}

export async function togglePref(formData: FormData) {
  const pref = formData.get("pref");
  const c = await cookies();
  if (pref === "contrast") c.set("sh_contrast", c.get("sh_contrast")?.value === "high" ? "normal" : "high", { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (pref === "text") c.set("sh_text", c.get("sh_text")?.value === "lg" ? "normal" : "lg", { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
