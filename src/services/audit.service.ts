import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requirePermission, type Actor } from "@/lib/auth/permissions";

export const AUDIT_ACTIONS = {
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_UPDATED: "DOCUMENT_UPDATED",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  DOCUMENT_PUBLISHED: "DOCUMENT_PUBLISHED",
  DOCUMENT_RESTORED: "DOCUMENT_RESTORED",
  VERSION_CREATED: "VERSION_CREATED",
  NAVIGATION_CREATED: "NAVIGATION_CREATED",
  NAVIGATION_UPDATED: "NAVIGATION_UPDATED",
  NAVIGATION_DELETED: "NAVIGATION_DELETED",
  NAVIGATION_MOVED: "NAVIGATION_MOVED",
  NAVIGATION_RESTORED: "NAVIGATION_RESTORED",
  MEDIA_UPLOADED: "MEDIA_UPLOADED",
} as const;

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Best-effort audit write — never throws into the calling flow. */
export async function logAudit(actor: { id: string } | null, event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: actor?.id ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}

export async function listAuditLogs(actor: Actor, limit = 100) {
  requirePermission(actor, "audit.view");
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(limit, 500));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
    user: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
  }));
}
