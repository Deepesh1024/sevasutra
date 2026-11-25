import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const payload = verifyToken(url.searchParams.get("t") ?? "", "email");
  const base = process.env.APP_URL ?? url.origin;
  if (!payload) return NextResponse.redirect(`${base}/account?error=verify#notifications`);
  const { uid, email } = JSON.parse(payload) as { uid: string; email: string };
  const u = await db.user.findUnique({ where: { id: uid } });
  if (!u || u.email !== email) return NextResponse.redirect(`${base}/account?error=verify#notifications`);
  await db.user.update({ where: { id: uid }, data: { emailVerifiedAt: new Date() } });
  await audit({ actorId: uid, actorType: "user", action: "account.email_verified", entityType: "user", entityId: uid });
  return NextResponse.redirect(`${base}/account?verified=1#notifications`);
}
