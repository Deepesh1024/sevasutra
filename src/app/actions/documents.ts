"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentUser } from "@/lib/auth/session";
import { hasConsent, grantConsent } from "@/lib/profile/service";
import { DOC_MAP } from "@/lib/documents/types";
import { ALLOWED, MAX_BYTES, deleteStored, scanner, sniffType, storeEncrypted } from "@/lib/documents/storage";
import { verifyDocument } from "@/lib/documents/verify";
import { FIELD_MAP } from "@/lib/profile/fields";
import { rateLimit } from "@/lib/ratelimit";
import { isApplicant } from "@/lib/auth/roles";

export type UploadState = { ok?: boolean; error?: string; duplicateOf?: string; rejected?: boolean; note?: string };

export async function uploadDocumentAction(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const user = await currentUser();
  if (!user || !isApplicant(user)) return { error: "Verify your mobile number to use the document vault." };
  if (fd.get("consent_documents") === "on" && !(await hasConsent(user.id, "documents"))) await grantConsent(user.id, "documents");
  if (!(await hasConsent(user.id, "documents"))) return { error: "Please accept the document-storage notice first." };
  if (!(await rateLimit(`upload:${user.id}`, 30, 3600))) return { error: "Too many uploads. Try again later." };

  const docType = String(fd.get("docType") ?? "");
  if (!DOC_MAP[docType]) return { error: "Choose a document type." };
  const file = [fd.get("file"), fd.get("camera")].find((f): f is File => f instanceof File && f.size > 0);
  if (!file) return { error: "Choose a file or take a photo." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 5 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffType(buf);
  if (!mime || !ALLOWED[mime]) return { error: "Only PDF, JPG or PNG files are accepted." };

  const scan = await scanner.scan(buf);
  if (scan !== "clean") {
    await audit({ actorId: user.id, actorType: "user", action: "document.rejected", entityType: "document", metadata: { reason: scan, docType } });
    return { error: scan === "infected" ? "This file failed the security scan and was not stored." : "We couldn't scan this file. Please try again." };
  }

  // OCR → LLM check that this really is the declared document. Wrong or unreadable documents are rejected
  // and never stored.
  const check = await verifyDocument(docType, buf, mime);
  if (!check.accept) {
    await audit({ actorId: user.id, actorType: "user", action: "document.rejected", entityType: "document", metadata: { reason: "verification_failed", declared: docType, detected: check.detectedType, method: check.method, confidence: check.confidence } });
    return { error: check.reason, rejected: true };
  }

  const stored = await storeEncrypted(buf);
  const dup = await db.document.findFirst({ where: { userId: user.id, sha256: stored.sha256, status: "active" } });
  if (dup && fd.get("allow_duplicate") !== "on") {
    await deleteStored(stored.storageKey);
    return { error: `You already uploaded this exact file as "${DOC_MAP[dup.docType]?.label.en ?? dup.docType}". Tick "store a second copy" if you really need it.`, duplicateOf: dup.id };
  }

  const issuedRaw = String(fd.get("issuedAt") ?? "");
  const issuedAt = /^\d{4}-\d{2}-\d{2}$/.test(issuedRaw) ? new Date(issuedRaw) : null;
  const months = DOC_MAP[docType].validityMonths;
  const expiresAt = months ? new Date((issuedAt ?? new Date()).getTime() + months * 30.44 * 86400_000) : null;
  const ext = ALLOWED[mime].ext;
  const profileId = String(fd.get("profileId") ?? "") || null;
  if (profileId) await db.profile.findFirstOrThrow({ where: { id: profileId, userId: user.id } });

  const doc = await db.document.create({
    data: {
      userId: user.id, profileId, docType, displayName: `${docType.replace(/_/g, "-")}.${ext}`, mimeType: mime, sizeBytes: buf.length,
      sha256: stored.sha256, storageKey: stored.storageKey, encIv: stored.iv, encTag: stored.tag, scanStatus: "clean", issuedAt, expiresAt,
      verifyStatus: check.status === "verified" ? "verified" : "unverified", verifyMethod: check.method, verifyConfidence: check.confidence, verifyNote: check.reason.slice(0, 300),
    },
  });
  // Values read from the document are suggestions only; the user must confirm them on the Documents page.
  await db.documentExtraction.create({ data: { documentId: doc.id, provider: check.method, docTypeGuess: check.detectedType, fields: check.fields as never } });
  await audit({ actorId: user.id, actorType: "user", action: "document.uploaded", entityType: "document", entityId: doc.id, metadata: { docType, sizeBytes: buf.length, mime, verified: check.status, method: check.method, confidence: check.confidence } });
  revalidatePath("/documents");
  return { ok: true, note: check.reason };
}

export async function deleteDocumentAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const id = String(fd.get("id"));
  const doc = await db.document.findFirst({ where: { id, userId: user.id, status: "active" } });
  if (doc) {
    await deleteStored(doc.storageKey);
    await db.document.update({ where: { id }, data: { status: "deleted", deletedAt: new Date() } });
    // Facts that came from this document are no longer supported by evidence.
    await db.profileFact.updateMany({ where: { documentId: id, supersededAt: null }, data: { supersededAt: new Date() } });
    await audit({ actorId: user.id, actorType: "user", action: "document.deleted", entityType: "document", entityId: id });
  }
  revalidatePath("/documents");
}

/** The user confirms (or edits) an extracted value — only then does it become a document_extracted fact. */
export async function confirmExtractionAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const extractionId = String(fd.get("extractionId"));
  const ex = await db.documentExtraction.findFirst({ where: { id: extractionId, document: { userId: user.id } }, include: { document: true } });
  if (!ex) redirect("/documents");
  const fields = (ex.fields as { key: string; value: unknown }[]) ?? [];
  const profileId = ex.document.profileId ?? (await db.profile.findFirstOrThrow({ where: { userId: user.id, isPrimary: true } })).id;
  if (fd.get("decision") === "reject") {
    await db.documentExtraction.update({ where: { id: ex.id }, data: { status: "rejected" } });
  } else {
    for (const f of fields) {
      if (!FIELD_MAP[f.key] || fd.get(`accept_${f.key}`) !== "on") continue;
      await db.profileFact.create({ data: { profileId, key: f.key, value: (fd.get(`value_${f.key}`) ?? f.value) as never, provenance: "document_extracted", source: `document:${ex.documentId}`, documentId: ex.documentId, expiresAt: ex.document.expiresAt } });
    }
    await db.documentExtraction.update({ where: { id: ex.id }, data: { status: "confirmed", confirmedAt: new Date() } });
  }
  await audit({ actorId: user.id, actorType: "user", action: "document.extraction_reviewed", entityType: "document", entityId: ex.documentId, metadata: { decision: String(fd.get("decision")) } });
  revalidatePath("/documents");
}
