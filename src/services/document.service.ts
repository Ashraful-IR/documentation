import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { documentVersions, documents, navigation } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { extractTextFromDoc } from "@/lib/content/text";
import { requirePermission, PERMISSIONS, type Actor } from "@/lib/auth/permissions";
import { logAudit, AUDIT_ACTIONS } from "./audit.service";
import type { TiptapJson } from "@/db/schema";
import type { DocumentDetail, DocumentVersionSummary } from "@/types";

const DOC_NOT_FOUND = "DOCUMENT_NOT_FOUND";
const VERSION_NOT_FOUND = "VERSION_NOT_FOUND";
const DOC_DELETED = "DOCUMENT_DELETED";

const EMPTY_DOC: TiptapJson = { type: "doc", content: [] };

export async function createDocument(
  actor: Actor,
  input: { title: string; content?: TiptapJson; status?: "DRAFT" | "PUBLISHED" },
) {
  requirePermission(actor, PERMISSIONS.CREATE);
  const content = input.content ?? EMPTY_DOC;
  const [doc] = await db
    .insert(documents)
    .values({
      title: input.title,
      content,
      contentText: extractTextFromDoc(content),
      status: input.status ?? "DRAFT",
      createdBy: actor.id,
      updatedBy: actor.id,
      ...(input.status === "PUBLISHED"
        ? { publishedBy: actor.id, publishedAt: new Date(), currentVersion: 1 }
        : {}),
    })
    .returning();
  await logAudit(actor, { action: AUDIT_ACTIONS.DOCUMENT_CREATED, entityType: "document", entityId: doc.id });
  if (input.status === "PUBLISHED") {
    await writeVersion(actor, doc.id, { title: doc.title, content, changeSummary: "Initial version" }, 1);
  }
  return toDetail(doc);
}

export async function getDocument(actor: Actor, id: string): Promise<DocumentDetail> {
  requirePermission(actor, PERMISSIONS.READ);
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
  if (doc.deletedAt) throw new ApiError(DOC_DELETED, "Document is in trash", 404);
  return toDetail(doc);
}

/**
 * Autosave path (§13): updates content directly, NEVER writes a version row.
 */
export async function updateDocumentContent(
  actor: Actor,
  id: string,
  input: { title?: string; content?: TiptapJson },
): Promise<DocumentDetail> {
  requirePermission(actor, PERMISSIONS.UPDATE);
  const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!existing) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
  if (existing.deletedAt) throw new ApiError(DOC_DELETED, "Document is in trash", 409);

  const content = input.content ?? (existing.content as TiptapJson);
  const [updated] = await db
    .update(documents)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      content,
      contentText: extractTextFromDoc(content),
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();

  await logAudit(actor, { action: AUDIT_ACTIONS.DOCUMENT_UPDATED, entityType: "document", entityId: id });
  return toDetail(updated);
}

/** Publish: writes a version row + flips status (§13). */
export async function publishDocument(
  actor: Actor,
  id: string,
  input: { changeSummary?: string | null },
): Promise<DocumentDetail> {
  requirePermission(actor, PERMISSIONS.PUBLISH);
  return db.transaction(async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, id)).for("update").limit(1);
    if (!doc) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
    if (doc.deletedAt) throw new ApiError(DOC_DELETED, "Document is in trash", 409);

    const versionNumber = doc.currentVersion + 1;
    await tx.insert(documentVersions).values({
      documentId: id,
      versionNumber,
      title: doc.title,
      content: doc.content,
      changeSummary: input.changeSummary ?? "Published",
      createdBy: actor.id,
    });
    const [updated] = await tx
      .update(documents)
      .set({
        status: "PUBLISHED",
        currentVersion: versionNumber,
        publishedBy: actor.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    await logAudit(actor, {
      action: AUDIT_ACTIONS.DOCUMENT_PUBLISHED,
      entityType: "document",
      entityId: id,
      metadata: { versionNumber },
    });
    return toDetail(updated);
  });
}

/** Manual checkpoint: writes a version row WITHOUT changing status (§13). */
export async function checkpointDocument(
  actor: Actor,
  id: string,
  input: { changeSummary?: string | null },
): Promise<DocumentDetail> {
  requirePermission(actor, PERMISSIONS.UPDATE);
  return db.transaction(async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, id)).for("update").limit(1);
    if (!doc) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
    if (doc.deletedAt) throw new ApiError(DOC_DELETED, "Document is in trash", 409);

    const versionNumber = doc.currentVersion + 1;
    await tx.insert(documentVersions).values({
      documentId: id,
      versionNumber,
      title: doc.title,
      content: doc.content,
      changeSummary: input.changeSummary ?? null,
      createdBy: actor.id,
    });
    const [updated] = await tx
      .update(documents)
      .set({ currentVersion: versionNumber, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    await logAudit(actor, {
      action: AUDIT_ACTIONS.VERSION_CREATED,
      entityType: "document",
      entityId: id,
      metadata: { versionNumber, kind: "checkpoint" },
    });
    return toDetail(updated);
  });
}

async function writeVersion(
  actor: Actor,
  documentId: string,
  input: { title: string; content: TiptapJson; changeSummary: string | null },
  versionNumber: number,
): Promise<void> {
  await db.insert(documentVersions).values({
    documentId,
    versionNumber,
    title: input.title,
    content: input.content,
    changeSummary: input.changeSummary,
    createdBy: actor.id,
  });
}

export async function softDeleteDocument(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.DELETE);
  const [updated] = await db
    .update(documents)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning({ id: documents.id });
  if (!updated) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
  await logAudit(actor, { action: AUDIT_ACTIONS.DOCUMENT_DELETED, entityType: "document", entityId: id });
}

export async function restoreDocument(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.UPDATE);
  const [updated] = await db
    .update(documents)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(documents.id, id))
    .returning({ id: documents.id });
  if (!updated) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
  await logAudit(actor, { action: "DOCUMENT_RESTORED", entityType: "document", entityId: id });
}

export async function hardDeleteDocument(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.DELETE);
  await db.delete(documents).where(eq(documents.id, id));
  await logAudit(actor, { action: "DOCUMENT_HARD_DELETED", entityType: "document", entityId: id });
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function listVersions(actor: Actor, documentId: string): Promise<DocumentVersionSummary[]> {
  requirePermission(actor, PERMISSIONS.READ);
  const rows = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    versionNumber: r.versionNumber,
    title: r.title,
    changeSummary: r.changeSummary,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getVersion(actor: Actor, documentId: string, versionNumber: number) {
  requirePermission(actor, PERMISSIONS.READ);
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.versionNumber, versionNumber)))
    .limit(1);
  if (!version) throw new ApiError(VERSION_NOT_FOUND, "Version not found", 404);
  return {
    id: version.id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    title: version.title,
    changeSummary: version.changeSummary,
    content: version.content,
    createdAt: version.createdAt.toISOString(),
  };
}

/**
 * Restores a version's content into the document. The pre-restore state is
 * snapshotted as a new version so the restore itself is undoable (§13).
 */
export async function restoreVersion(actor: Actor, documentId: string, versionNumber: number): Promise<DocumentDetail> {
  requirePermission(actor, PERMISSIONS.UPDATE);
  return db.transaction(async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId)).for("update").limit(1);
    if (!doc) throw new ApiError(DOC_NOT_FOUND, "Document not found", 404);
    const [version] = await tx
      .select()
      .from(documentVersions)
      .where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.versionNumber, versionNumber)))
      .limit(1);
    if (!version) throw new ApiError(VERSION_NOT_FOUND, "Version not found", 404);

    // Snapshot current state so the restore can be undone.
    const nextNumber = doc.currentVersion + 1;
    await tx.insert(documentVersions).values({
      documentId,
      versionNumber: nextNumber,
      title: doc.title,
      content: doc.content,
      changeSummary: `State before restoring v${versionNumber}`,
      createdBy: actor.id,
    });

    const [updated] = await tx
      .update(documents)
      .set({
        title: version.title,
        content: version.content,
        contentText: extractTextFromDoc(version.content),
        currentVersion: nextNumber,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId))
      .returning();
    await logAudit(actor, {
      action: AUDIT_ACTIONS.DOCUMENT_RESTORED,
      entityType: "document",
      entityId: documentId,
      metadata: { versionNumber },
    });
    return toDetail(updated);
  });
}

/** Finds the navigation node that points at a document (if any). */
export async function findNavNodeForDocument(documentId: string) {
  const [row] = await db
    .select({ id: navigation.id })
    .from(navigation)
    .where(eq(navigation.documentId, documentId))
    .limit(1);
  return row ?? null;
}

function toDetail(doc: {
  id: string;
  title: string;
  content: unknown;
  contentText: string | null;
  status: "DRAFT" | "PUBLISHED";
  currentVersion: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}): DocumentDetail {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    contentText: doc.contentText ?? "",
    status: doc.status,
    currentVersion: doc.currentVersion,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
  };
}
