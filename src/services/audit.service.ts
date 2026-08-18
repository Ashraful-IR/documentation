import { count, desc, eq, lt } from "drizzle-orm";

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

/** Actions that fire at high frequency (e.g. autosave) — suppressed after the
 *  first write within a per-entity cooldown window to avoid flooding audit_logs. */
const NOISY_ACTIONS: Set<string> = new Set([AUDIT_ACTIONS.DOCUMENT_UPDATED]);
const COOLDOWN_MS = 60_000; // 1 minute

/** Cache of last-write timestamps keyed by "action:entityId". */
const lastWrite = new Map<string, number>();

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Best-effort audit write — never throws into the calling flow.
 *  Suppresses noisy actions (autosave) to at most one per entity per minute. */
export async function logAudit(actor: { id: string } | null, event: AuditEvent): Promise<void> {
  try {
    if (NOISY_ACTIONS.has(event.action)) {
      const key = `${event.action}:${event.entityId}`;
      const now = Date.now();
      const last = lastWrite.get(key) ?? 0;
      if (now - last < COOLDOWN_MS) return; // suppressed
      lastWrite.set(key, now);
    }
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
 * Deletes audit logs older than `days` (default 90).
 * Returns the number of rows removed. Safe to call periodically.
 */
export async function cleanupOldAuditLogs(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  try {
    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoff))
      .returning({ id: auditLogs.id });
    return result.length;
  } catch (err) {
    console.error("[audit] cleanup failed:", err);
    return 0;
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
