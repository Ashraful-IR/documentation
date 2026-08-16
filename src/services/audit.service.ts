import { count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import type { AuditLogPage } from "@/types";

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

/**
 * Lists audit entries, newest first, one page at a time.
 * Defaults to 15 rows per page; pageSize is capped at 100.
 */
export async function listAuditLogs(actor: Actor, page = 1, pageSize = 15): Promise<AuditLogPage> {
  requirePermission(actor, "audit.view");
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize) || 1), 100);
  const offset = (safePage - 1) * safePageSize;

  const [{ total }] = await db.select({ total: count() }).from(auditLogs);
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
    .limit(safePageSize)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
      user: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
    })),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}
