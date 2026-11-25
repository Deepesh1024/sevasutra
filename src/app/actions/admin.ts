"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/session";
import { createVersion, denormalise, chunksFor, detectInjection } from "@/lib/schemes/versioning";
import { hashRule } from "@/lib/engine/evaluate";
import { publishWithChecks } from "@/lib/admin/publish";
import type { SchemeContent, TestCaseSpec } from "@/lib/schemes/types";
import { processDue } from "@/lib/notify/queue";
import { scheduleReminders } from "@/lib/notify/scheduler";
import { redactText } from "@/lib/redact";

const back = (path: string, msg: string, kind: "ok" | "err" = "ok") => redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

function validateContent(raw: string): { content?: SchemeContent; error?: string } {
  let c: SchemeContent;
  try { c = JSON.parse(raw); } catch { return { error: "Content is not valid JSON." }; }
  const req: (keyof SchemeContent)[] = ["schemeId", "name", "ministry", "level", "category", "kind", "lifecycleStatus", "summary", "officialDescription", "benefit", "rule", "documents", "application", "sources", "effectiveFrom"];
  for (const k of req) if (c[k] === undefined) return { error: `Missing field: ${k}` };
  if (!/^[a-z0-9-]{3,60}$/.test(c.schemeId)) return { error: "schemeId must be lowercase letters, digits and dashes." };
  if (!c.rule?.mandatory || c.rule.schemaVersion !== 1) return { error: "rule.mandatory and rule.schemaVersion = 1 are required." };
  if (!c.benefit?.basis?.en) return { error: "benefit.basis.en is required (always state the monetary basis)." };
  if (!c.sources?.length) return { error: "At least one source is required." };
  if (c.isThirdParty && !c.provider?.name) return { error: "Third-party opportunities must name the provider." };
  return { content: c };
}

export async function newDraftAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const schemeId = String(fd.get("schemeId"));
  const cur = await db.schemeVersion.findFirst({ where: { schemeId, status: "published" } });
  const base = await db.schemeVersion.findFirst({ where: { schemeId }, orderBy: { version: "desc" } });
  const src = cur ?? base;
  if (!src) back("/admin/schemes", "Scheme not found", "err");
  const existingDraft = await db.schemeVersion.findFirst({ where: { schemeId, status: { in: ["draft", "in_review"] } } });
  if (existingDraft) redirect(`/admin/versions/${existingDraft.id}`);
  const v = await createVersion(db, src!.content as unknown as SchemeContent, { status: "draft", authorId: user.id, changeNote: "" });
  await audit({ actorId: user.id, actorType: user.role === "admin" ? "admin" : "operator", action: "scheme.draft_created", entityType: "scheme_version", entityId: v.id, metadata: { schemeId, from: src!.id } });
  redirect(`/admin/versions/${v.id}`);
}

export async function importSchemeAction(fd: FormData) {
  const user = await requireStaff(["admin"]);
  const { content, error } = validateContent(String(fd.get("content") ?? ""));
  if (!content) return back("/admin/import", error!, "err");
  if (await db.scheme.findUnique({ where: { id: content.schemeId } })) return back("/admin/import", "A scheme with this id already exists — create a new draft version instead.", "err");
  const v = await createVersion(db, content, { status: "draft", authorId: user.id, changeNote: "Imported" });
  await audit({ actorId: user.id, actorType: "admin", action: "scheme.imported", entityType: "scheme_version", entityId: v.id, metadata: { schemeId: content.schemeId } });
  redirect(`/admin/versions/${v.id}`);
}

export async function saveDraftAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const id = String(fd.get("id"));
  const path = `/admin/versions/${id}`;
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id } });
  if (v.status !== "draft") return back(path, "Only drafts can be edited. Published versions are immutable.", "err");
  const { content, error } = validateContent(String(fd.get("content") ?? ""));
  if (!content) return back(path, error!, "err");
  if (content.schemeId !== v.schemeId) return back(path, "schemeId cannot change.", "err");
  const ruleJson = String(fd.get("rule") ?? "");
  if (ruleJson) {
    try { content.rule = JSON.parse(ruleJson); } catch { return back(path, "Rule JSON is invalid.", "err"); }
  }
  await db.$transaction(async (tx) => {
    await tx.schemeVersion.update({ where: { id }, data: { content: content as never, changeNote: String(fd.get("changeNote") ?? "").slice(0, 500), ...denormalise(content) } });
    await tx.eligibilityRule.update({ where: { schemeVersionId: id }, data: { definition: content.rule as never, ruleHash: hashRule(content.rule), effectiveFrom: new Date(content.effectiveFrom) } });
    await tx.contentChunk.deleteMany({ where: { schemeVersionId: id } });
    await tx.contentChunk.createMany({ data: chunksFor(content).map((ch) => ({ ...ch, schemeVersionId: id, injectionFlag: detectInjection(ch.text) })) });
  });
  await audit({ actorId: user.id, actorType: user.role === "admin" ? "admin" : "operator", action: "scheme.draft_saved", entityType: "scheme_version", entityId: id, metadata: { ruleHash: hashRule(content.rule) } });
  back(path, "Draft saved.");
}

export async function submitForReviewAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const id = String(fd.get("id"));
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id } });
  if (v.status !== "draft") return back(`/admin/versions/${id}`, "Not a draft.", "err");
  if (!v.changeNote?.trim()) return back(`/admin/versions/${id}`, "Add a change note explaining what changed and why.", "err");
  await db.schemeVersion.update({ where: { id }, data: { status: "in_review" } });
  await audit({ actorId: user.id, actorType: user.role === "admin" ? "admin" : "operator", action: "scheme.submitted_for_review", entityType: "scheme_version", entityId: id });
  back(`/admin/versions/${id}`, "Submitted for review.");
}

export async function rejectVersionAction(fd: FormData) {
  const user = await requireStaff(["admin"]);
  const id = String(fd.get("id"));
  await db.schemeVersion.update({ where: { id }, data: { status: "draft", reviewerId: user.id, reviewedAt: new Date() } });
  await audit({ actorId: user.id, actorType: "admin", action: "scheme.review_returned", entityType: "scheme_version", entityId: id, metadata: { note: redactText(String(fd.get("note") ?? "")).slice(0, 300) } });
  back(`/admin/versions/${id}`, "Returned to draft.");
}

export async function publishAction(fd: FormData) {
  const user = await requireStaff(["admin"]);
  const id = String(fd.get("id"));
  const r = await publishWithChecks(id, user.id);
  revalidatePath("/schemes");
  if (!r.ok) return back(`/admin/versions/${id}`, r.error, "err");
  back(`/admin/versions/${id}`, `Published. ${r.corrections} user result(s) changed and will be notified; ${r.deadlineNotices} deadline-change notice(s) queued.`);
}

export async function markVerifiedAction(fd: FormData) {
  const user = await requireStaff(["admin"]);
  const id = String(fd.get("id"));
  await db.schemeVersion.update({ where: { id }, data: { lastVerifiedAt: new Date() } });
  await audit({ actorId: user.id, actorType: "admin", action: "scheme.verified", entityType: "scheme_version", entityId: id });
  revalidatePath("/schemes");
  back(`/admin/versions/${id}`, "Marked as verified against the official source today.");
}

export async function addTestCaseAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const id = String(fd.get("versionId"));
  const v = await db.schemeVersion.findUniqueOrThrow({ where: { id } });
  let facts: TestCaseSpec["facts"];
  try { facts = JSON.parse(String(fd.get("facts") ?? "{}")); } catch { return back(`/admin/versions/${id}`, "Test facts must be JSON.", "err"); }
  const spec: TestCaseSpec = { name: String(fd.get("name") ?? "Custom case").slice(0, 120), kind: (String(fd.get("kind")) as TestCaseSpec["kind"]) || "other", facts, expected: String(fd.get("expected")), now: new Date().toISOString() };
  await db.ruleTestCase.create({ data: { schemeId: v.schemeId, name: spec.name, kind: spec.kind, facts: spec as never, documents: [], expected: spec.expected, referenceDate: new Date() } });
  await audit({ actorId: user.id, actorType: "admin", action: "rule_test.added", entityType: "scheme", entityId: v.schemeId, metadata: { name: spec.name } });
  back(`/admin/versions/${id}`, "Test case added.");
}

export async function checkSourceAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const id = String(fd.get("id"));
  const s = await db.source.findUniqueOrThrow({ where: { id } });
  let status: number | null = null;
  let hash: string | null = null;
  let note = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(s.url, { headers: { "User-Agent": "SevaSutraSourceMonitor/1.0 (+source freshness check)" }, redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    status = res.status;
    const body = Buffer.from(await res.arrayBuffer());
    hash = createHash("sha256").update(body).digest("hex");
    if (s.contentHash && s.contentHash !== hash) note = "Content changed since last check — review for guideline updates.";
  } catch (e) {
    note = `Fetch failed: ${String(e).slice(0, 120)}`;
  }
  await db.sourceSnapshot.create({ data: { sourceId: id, httpStatus: status, contentHash: hash, parserVersion: "hash-only-1", notes: note || null } });
  await db.source.update({ where: { id }, data: { lastFetchedAt: new Date(), lastHttpStatus: status, contentHash: hash ?? s.contentHash } });
  await audit({ actorId: user.id, actorType: "admin", action: "source.checked", entityType: "source", entityId: id, metadata: { status, changed: !!note } });
  back("/admin/sources", `${s.title}: HTTP ${status ?? "error"}${note ? ` — ${note}` : ""}`, status && status < 400 ? "ok" : "err");
}

export async function setSourceStatusAction(fd: FormData) {
  const user = await requireStaff(["admin"]);
  const id = String(fd.get("id"));
  const st = ["pending", "approved", "blocked"].includes(String(fd.get("status"))) ? String(fd.get("status")) : "pending";
  await db.source.update({ where: { id }, data: { reviewerStatus: st } });
  await audit({ actorId: user.id, actorType: "admin", action: "source.review_status", entityType: "source", entityId: id, metadata: { status: st } });
  back("/admin/sources", "Updated.");
}

export async function respondFeedbackAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const id = String(fd.get("id"));
  const status = ["open", "triaged", "resolved"].includes(String(fd.get("status"))) ? String(fd.get("status")) : "triaged";
  await db.feedback.update({ where: { id }, data: { status, response: redactText(String(fd.get("response") ?? "")).slice(0, 2000) || undefined, assigneeId: user.id, resolvedAt: status === "resolved" ? new Date() : null } });
  await audit({ actorId: user.id, actorType: user.role === "admin" ? "admin" : "operator", action: "feedback.updated", entityType: "feedback", entityId: id, metadata: { status } });
  back("/admin/feedback", "Feedback updated.");
}

export async function saveTranslationAction(fd: FormData) {
  const user = await requireStaff(["admin", "support"]);
  const term = String(fd.get("term") ?? "").trim().slice(0, 100);
  const text = String(fd.get("text") ?? "").trim().slice(0, 200);
  if (!term || !text) return back("/admin/translations", "Term and translation are required.", "err");
  const status = user.role === "admin" && fd.get("approve") === "on" ? "approved" : "draft";
  await db.translation.upsert({ where: { term_locale: { term, locale: "hi" } }, update: { text, status, updatedById: user.id }, create: { term, locale: "hi", text, status, updatedById: user.id } });
  await audit({ actorId: user.id, actorType: "admin", action: "translation.saved", entityType: "translation", entityId: term, metadata: { status } });
  back("/admin/translations", "Saved.");
}

export async function runNotificationsAction() {
  const user = await requireStaff(["admin"]);
  const scheduled = await scheduleReminders(db);
  const stats = await processDue(db);
  await audit({ actorId: user.id, actorType: "admin", action: "notifications.run", entityType: "system", metadata: { scheduled, ...stats } });
  back("/admin/notifications", `Scheduler considered ${scheduled}; sent ${stats.sent}, deferred ${stats.deferred} (quiet hours), suppressed ${stats.suppressed}, failed ${stats.failed}, dead ${stats.dead}.`);
}

export type ExtractState = { candidates?: import("@/lib/admin/extract").Candidate[]; text?: string };

export async function extractAction(_prev: ExtractState, fd: FormData): Promise<ExtractState> {
  await requireStaff(["admin", "support"]);
  const { extractCandidates } = await import("@/lib/admin/extract");
  const text = String(fd.get("text") ?? "").slice(0, 50_000);
  return { text, candidates: extractCandidates(text) };
}
