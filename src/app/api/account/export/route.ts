import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

// Data portability: everything SevaSutra holds about the signed-in user, as JSON. Document files are listed
// (metadata) but their contents are downloaded individually from the vault.
export async function GET() {
  const s = await getSession();
  if (!s?.user) return new NextResponse("Sign in required", { status: 401 });
  const id = s.user.id;
  const [user, identities, consents, profiles, documents, evaluations, applications, saved, notifications] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, role: true, displayName: true, email: true, emailVerifiedAt: true, phoneE164: true, phoneVerifiedAt: true, locale: true, notificationPrefs: true, createdAt: true } }),
    db.identity.findMany({ where: { userId: id }, select: { provider: true, email: true, linkedAt: true } }),
    db.consent.findMany({ where: { userId: id } }),
    db.profile.findMany({ where: { userId: id }, include: { facts: true } }),
    db.document.findMany({ where: { userId: id, status: "active" }, select: { id: true, docType: true, displayName: true, mimeType: true, sizeBytes: true, issuedAt: true, expiresAt: true, createdAt: true } }),
    db.evaluation.findMany({ where: { userId: id }, select: { id: true, schemeId: true, schemeVersionId: true, ruleHash: true, engineVersion: true, status: true, referenceDate: true, createdAt: true, inputSnapshot: true } }),
    db.application.findMany({ where: { userId: id } }),
    db.savedScheme.findMany({ where: { userId: id } }),
    db.notification.findMany({ where: { userId: id }, select: { template: true, status: true, createdAt: true, sentAt: true } }),
  ]);
  await audit({ actorId: id, actorType: "user", action: "account.exported", entityType: "user", entityId: id });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), user, identities, consents, profiles, documents, evaluations, applications, saved, notifications }, null, 2);
  return new NextResponse(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="sahayak-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
