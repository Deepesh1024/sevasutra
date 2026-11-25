import { db } from "./db";
import { redactObject } from "./redact";

export type ActorType = "user" | "guest" | "operator" | "admin" | "system";

export async function audit(e: {
  actorId?: string | null;
  actorType: ActorType;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}) {
  await db.auditEvent.create({
    data: {
      actorId: e.actorId ?? null,
      actorType: e.actorType,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      metadata: (redactObject(e.metadata ?? {}) as object) ?? {},
      ipHash: e.ipHash ?? null,
    },
  });
}

/** Structured log line with redaction. */
export function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(redactObject(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
