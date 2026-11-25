import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { verifyToken } from "@/lib/crypto";
import { readDecrypted } from "@/lib/documents/storage";
import { audit } from "@/lib/audit";

// Document download: requires BOTH a valid short-lived signed token AND the owner's session.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const s = await getSession();
  const payload = verifyToken(token, "doc");
  if (!s?.user || !payload) return new NextResponse("Link expired or not authorised", { status: 403 });
  const { docId, userId } = JSON.parse(payload) as { docId: string; userId: string };
  if (docId !== id || userId !== s.user.id) return new NextResponse("Not authorised", { status: 403 });
  const doc = await db.document.findFirst({ where: { id, userId: s.user.id, status: "active", scanStatus: "clean" } });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const buf = await readDecrypted(doc.storageKey, doc.encIv, doc.encTag);
  await audit({ actorId: s.user.id, actorType: "user", action: "document.downloaded", entityType: "document", entityId: id });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${doc.displayName}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
