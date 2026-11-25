"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { answer, PROMPT_VERSION, type ChatAnswer } from "@/lib/chat/assistant";
import { clientIpHash, currentUser, getSession } from "@/lib/auth/session";
import { getLang } from "@/lib/i18n/server";
import { hmac, randomToken } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { redactText } from "@/lib/redact";
import { audit } from "@/lib/audit";

async function sessionKey() {
  const s = await getSession();
  if (s) return hmac(s.id, "chat").slice(0, 32);
  const c = await cookies();
  let g = c.get("sh_guest")?.value;
  if (!g) {
    g = randomToken(16);
    c.set("sh_guest", g, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
  }
  return hmac(g, "chat").slice(0, 32);
}

export async function askAction(question: string): Promise<ChatAnswer> {
  const ip = await clientIpHash();
  if (!(await rateLimit(`chat:${ip}`, 40, 3600))) {
    return { kind: "refusal", refused: true, mode: "rule", text: "You've asked a lot of questions in a short time. Please try again later.", citations: [], warnings: [], links: [] };
  }
  const [user, lang, key] = await Promise.all([currentUser(), getLang(), sessionKey()]);
  const res = await answer(question, { user, lang });
  await db.chatMessage.createMany({
    data: [
      { sessionKey: key, role: "user", content: redactText(question.slice(0, 500)), promptVersion: PROMPT_VERSION },
      { sessionKey: key, role: "assistant", content: redactText(res.text), citations: res.citations.map((c) => ({ id: c.id, schemeId: c.schemeId, section: c.section, version: c.version })) as never, refused: res.refused, citationFailure: !!res.citationFailure, promptVersion: `${PROMPT_VERSION}:${res.mode}` },
    ],
  });
  return res;
}

export async function escalateAction(question: string, note: string): Promise<{ ok: boolean }> {
  const ip = await clientIpHash();
  if (!(await rateLimit(`escalate:${ip}`, 5, 3600))) return { ok: false };
  const user = await currentUser();
  const f = await db.feedback.create({ data: { userId: user?.id ?? null, kind: "question", message: redactText(`Chat escalation: ${question.slice(0, 500)}\n${note.slice(0, 1000)}`) } });
  await audit({ actorId: user?.id, actorType: user ? "user" : "guest", action: "chat.escalated", entityType: "feedback", entityId: f.id });
  return { ok: true };
}
