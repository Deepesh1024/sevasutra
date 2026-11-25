// Authorised-API application adapter framework.
// No government submission API is live in this MVP: the only registered adapter is a SANDBOX mock used to
// exercise consent, preview, idempotency, retries, dead-lettering and audit. Every scheme's default route is
// redirecting the applicant to the official portal.

import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";

export interface FieldMapping { from: string; to: string; transform?: (v: unknown) => unknown }

export interface SubmitResult { ok: boolean; externalRef?: string; retryable?: boolean; error?: string }

export interface ApplicationAdapter {
  id: string;
  /** "sandbox" adapters must never be presented as live. */
  environment: "sandbox" | "production";
  schemeIds: string[];
  mapping: FieldMapping[];
  submit(payload: Record<string, unknown>, idempotencyKey: string): Promise<SubmitResult>;
  status(externalRef: string): Promise<{ state: string }>;
}

export function buildPayload(adapter: ApplicationAdapter, facts: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const m of adapter.mapping) if (facts[m.from] !== undefined) out[m.to] = m.transform ? m.transform(facts[m.from]) : facts[m.from];
  return out;
}

/** Same user + scheme + payload → same key, so a double click can never create two applications. */
export function idempotencyKey(userId: string, schemeId: string, payload: Record<string, unknown>) {
  return createHash("sha256").update(`${userId}|${schemeId}|${JSON.stringify(payload)}`).digest("hex").slice(0, 40);
}

export const MAX_ATTEMPTS = 5;
export const backoffMs = (attempt: number) => Math.min(60 * 60_000, 30_000 * 2 ** (attempt - 1));

export class SandboxAdapter implements ApplicationAdapter {
  id = "sandbox-demo";
  environment = "sandbox" as const;
  schemeIds: string[] = [];
  mapping: FieldMapping[] = [
    { from: "state", to: "state_code" },
    { from: "annual_family_income", to: "family_income_inr" },
  ];
  private seen = new Map<string, string>();
  constructor(private failTimes = 0) {}
  async submit(_payload: Record<string, unknown>, key: string): Promise<SubmitResult> {
    if (this.failTimes > 0) {
      this.failTimes--;
      return { ok: false, retryable: true, error: "sandbox: transient error" };
    }
    if (!this.seen.has(key)) this.seen.set(key, `SBX-${key.slice(0, 8).toUpperCase()}`);
    return { ok: true, externalRef: this.seen.get(key) };
  }
  async status() {
    return { state: "under_verification" };
  }
}

export const ADAPTERS: ApplicationAdapter[] = [];

/** Process one queued external submission with retry/backoff; moves to "dead" after MAX_ATTEMPTS. */
export async function processExternal(db: PrismaClient, id: string, adapter: ApplicationAdapter) {
  const job = await db.externalApplication.findUniqueOrThrow({ where: { id } });
  if (job.status === "accepted" || job.status === "dead") return job;
  const attempts = job.attempts + 1;
  const r = await adapter.submit(job.payloadPreview as Record<string, unknown>, job.idempotencyKey);
  const data = r.ok
    ? { status: "accepted", attempts, externalRef: r.externalRef, lastError: null, nextAttemptAt: null }
    : attempts >= MAX_ATTEMPTS || !r.retryable
      ? { status: "dead", attempts, lastError: r.error ?? "failed", nextAttemptAt: null }
      : { status: "failed", attempts, lastError: r.error ?? "failed", nextAttemptAt: new Date(Date.now() + backoffMs(attempts)) };
  const updated = await db.externalApplication.update({ where: { id }, data });
  await db.auditEvent.create({ data: { actorType: "system", action: `external_application.${data.status}`, entityType: "external_application", entityId: id, metadata: { adapter: adapter.id, environment: adapter.environment, attempts } } });
  return updated;
}
