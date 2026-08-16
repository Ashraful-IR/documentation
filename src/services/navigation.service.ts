import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

// Transaction type derived from the pool's transaction callback.
type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

import { db } from "@/db";
import { documents, navigation, type NewNavigation, type NavigationRow } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { between, after, MAX_KEY_LENGTH, rebalanceKeys } from "@/lib/utils/fractional-index";
import { requirePermission, PERMISSIONS, type Actor } from "@/lib/auth/permissions";
import { logAudit, AUDIT_ACTIONS } from "./audit.service";
import { extractTextFromDoc } from "@/lib/content/text";
import type { NavigationNode } from "@/types";

/**
 * Navigation service — owns the self-referencing tree backed by an ltree
 * materialized `path` and fractional `sort_key` (§11, §19).
 *
 * Invariants:
 *  - `path` mirrors `parent_id`: path = parent.path || label(id).
 *  - ltree labels cannot contain hyphens, so UUID labels replace '-' with '_'.
 *  - Moves happen in a single transaction: row locks, cycle check, path
 *    rewrite for the whole subtree, sort_key midpoint.
 */

export function pathLabel(id: string): string {
  return id.replace(/-/g, "_");
}

export function nodePath(parentPath: string | null, id: string): string {
  const label = pathLabel(id);
  return parentPath ? `${parentPath}.${label}` : label;
}

const NAV_NOT_FOUND = "NAVIGATION_NOT_FOUND";
const NAV_PARENT_NOT_FOUND = "NAVIGATION_PARENT_NOT_FOUND";
const NAV_SLUG_TAKEN = "SLUG_ALREADY_EXISTS";
const NAV_DELETED = "NAVIGATION_DELETED";
const CYCLE_NOT_ALLOWED = "CYCLE_NOT_ALLOWED";

type NavType = "FOLDER" | "DOCUMENT" | "LINK";

export interface CreateNodeInput {
  parentId?: string | null;
  type: NavType;
  title: string;
  slug: string;
  documentId?: string | null;
  linkUrl?: string | null;
  description?: string | null;
  prevId?: string | null;
  nextId?: string | null;
}

export interface UpdateNodeInput {
  title?: string;
  slug?: string;
  linkUrl?: string | null;
  description?: string | null;
  icon?: string | null;
  isVisible?: boolean;
}

export interface MoveNodeInput {
  parentId: string | null;
  prevId?: string | null;
  nextId?: string | null;
}

function toTree(rows: NavigationRow[]): NavigationNode[] {
  const byParent = new Map<string | null, NavigationRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  }

  const build = (parentId: string | null, hidden: boolean): NavigationNode[] => {
    const children = byParent.get(parentId) ?? [];
    return children.map((row) => {
      const effectivelyHidden = hidden || !row.isVisible;
      return {
        id: row.id,
        parentId: row.parentId,
        type: row.type,
        title: row.title,
        slug: row.slug,
        documentId: row.documentId,
        linkUrl: row.linkUrl,
        icon: row.icon,
        description: row.description,
        isVisible: row.isVisible,
        sortKey: row.sortKey,
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
        effectivelyHidden,
        children: build(row.id, effectivelyHidden),
      };
    });
  };

  return build(null, false);
}

export async function getTree(actor: Actor): Promise<NavigationNode[]> {
  requirePermission(actor, PERMISSIONS.READ);
  const rows = await db
    .select()
    .from(navigation)
    .where(isNull(navigation.deletedAt))
    .orderBy(asc(navigation.sortKey));
  return toTree(rows);
}

/** All nodes including deleted (used by trash views). */
export async function getTrash(actor: Actor): Promise<NavigationNode[]> {
  requirePermission(actor, PERMISSIONS.READ);
  const rows = await db
    .select()
    .from(navigation)
    .where(sql`${navigation.deletedAt} IS NOT NULL`)
    .orderBy(asc(navigation.sortKey));
  return toTree(rows);
}

async function findParentPath(tx: Tx, parentId: string | null): Promise<string | null> {
  if (!parentId) return null;
  const [parent] = await tx.select().from(navigation).where(eq(navigation.id, parentId)).limit(1);
  if (!parent) throw new ApiError(NAV_PARENT_NOT_FOUND, "Parent item not found", 404);
  if (parent.deletedAt) throw new ApiError(NAV_DELETED, "Parent item is in trash", 409);
  return parent.path;
}

/** Fetches sibling keys and computes a fresh sort key for a new/moved node. */
async function computeSortKey(
  tx: Tx,
  parentId: string | null,
  excludeId: string | null,
  prevId?: string | null,
  nextId?: string | null,
): Promise<{ key: string; position: number }> {
  const conditions = [
    isNull(navigation.deletedAt),
    parentId ? eq(navigation.parentId, parentId) : isNull(navigation.parentId),
  ];
  if (excludeId) conditions.push(ne(navigation.id, excludeId));
  const siblings = await tx
    .select({ id: navigation.id, sortKey: navigation.sortKey })
    .from(navigation)
    .where(and(...conditions))
    .orderBy(asc(navigation.sortKey));

  let index = siblings.length;
  let prevKey: string | null = null;
  let nextKey: string | null = null;

  const prevIdx = prevId ? siblings.findIndex((s) => s.id === prevId) : -1;
  const nextIdx = nextId ? siblings.findIndex((s) => s.id === nextId) : -1;

  if (prevIdx >= 0) {
    // Insert right after `prevId` — bounded by its actual next sibling.
    index = prevIdx + 1;
    prevKey = siblings[prevIdx].sortKey;
    nextKey = siblings[index]?.sortKey ?? null;
  } else if (nextIdx >= 0) {
    // Insert right before `nextId` — bounded by its actual previous sibling.
    index = nextIdx;
    nextKey = siblings[nextIdx].sortKey;
    prevKey = siblings[nextIdx - 1]?.sortKey ?? null;
  } else {
    // Nothing matched (or no ids given) — append at the end of the list.
    index = siblings.length;
    prevKey = siblings.length > 0 ? siblings[siblings.length - 1].sortKey : null;
  }

  const key = between(prevKey, nextKey);
  if (key.length <= MAX_KEY_LENGTH) {
    return { key, position: index };
  }

  // Key grew too long — rebalance every sibling (§11).
  const newKeys = rebalanceKeys(siblings.length + 1);
  const updates = siblings.map((s, i) => {
    const k = i < index ? newKeys[i] : newKeys[i + 1];
    return tx.update(navigation).set({ sortKey: k }).where(eq(navigation.id, s.id));
  });
  await Promise.all(updates);
  return { key: newKeys[index], position: index };
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

/** Ensures a slug is unique among siblings. */
async function uniqueSlug(tx: Tx, parentId: string | null, slug: string, excludeId?: string): Promise<string> {
  const candidate = slug;
  let n = 1;
  let final = candidate;
  for (;;) {
    const existing = await tx
      .select({ id: navigation.id })
      .from(navigation)
      .where(
        and(
          parentId ? eq(navigation.parentId, parentId) : isNull(navigation.parentId),
          eq(navigation.slug, final),
        ),
      )
      .limit(1);
    if (existing.length === 0 || (excludeId && existing[0].id === excludeId)) return final;
    n++;
    final = `${candidate}-${n}`;
  }
}

/**
 * Creates a navigation node. When type === DOCUMENT and no documentId is
 * provided, a draft document is created and linked.
 */
export async function createNode(actor: Actor, input: CreateNodeInput): Promise<NavigationRow> {
  requirePermission(actor, PERMISSIONS.NAV_CREATE);
  const parentId = input.parentId ?? null;

  return db.transaction(async (tx) => {
    const parentPath = await findParentPath(tx, parentId);
    const slug = await uniqueSlug(tx, parentId, input.slug);

    let documentId: string | null = null;
    if (input.type === "DOCUMENT" && input.documentId) {
      documentId = input.documentId;
    } else if (input.type === "DOCUMENT") {
      const [doc] = await tx
        .insert(documents)
        .values({ title: input.title, content: { type: "doc", content: [] }, createdBy: actor.id, updatedBy: actor.id })
        .returning({ id: documents.id });
      documentId = doc.id;
    }

    const { key } = await computeSortKey(tx, parentId, null, input.prevId, input.nextId);

    const [node] = await tx
      .insert(navigation)
      .values({
        parentId,
        path: nodePath(parentPath, "placeholder"), // replaced below with real id
        type: input.type,
        title: input.title,
        slug,
        documentId: documentId ?? null,
        linkUrl: input.type === "LINK" ? input.linkUrl ?? null : null,
        description: input.description ?? null,
        sortKey: key,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    const realPath = nodePath(parentPath, node.id);
    await tx.update(navigation).set({ path: sql`${realPath}::ltree` }).where(eq(navigation.id, node.id));

    await logAudit(actor, {
      action: AUDIT_ACTIONS.NAVIGATION_CREATED,
      entityType: "navigation",
      entityId: node.id,
      metadata: { type: input.type, parentId },
    });
    return node;
  });
}

export async function updateNode(actor: Actor, id: string, input: UpdateNodeInput): Promise<NavigationRow> {
  requirePermission(actor, PERMISSIONS.NAV_UPDATE);
  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(navigation).where(eq(navigation.id, id)).for("update").limit(1);
    if (!node) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);

    const slug = input.slug !== undefined ? await uniqueSlug(tx, node.parentId, input.slug, id) : node.slug;
    const [updated] = await tx
      .update(navigation)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        slug,
        ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(navigation.id, id))
      .returning();
    await logAudit(actor, { action: AUDIT_ACTIONS.NAVIGATION_UPDATED, entityType: "navigation", entityId: id });
    return updated;
  });
}

/** Soft-deletes a node and its whole subtree (§18) — recoverable. */
export async function softDeleteNode(actor: Actor, id: string): Promise<{ deleted: number }> {
  requirePermission(actor, PERMISSIONS.NAV_DELETE);
  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(navigation).where(eq(navigation.id, id)).limit(1);
    if (!node) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);

    const deletedRows = await tx.execute(sql`
      UPDATE documentation.navigation
      SET deleted_at = now(), updated_by = ${actor.id}
      WHERE id = ${id} OR path <@ ${node.path}::ltree
      RETURNING id, document_id
    `);
    const docIds = (deletedRows as unknown as Array<{ document_id: string | null }>)
      .map((r) => r.document_id)
      .filter((d): d is string => !!d);
    if (docIds.length > 0) {
      await tx
        .update(documents)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(sql`${documents.id} IN (${sql.join(docIds.map((d) => sql`${d}`), sql`, `)})`);
    }
    await logAudit(actor, {
      action: AUDIT_ACTIONS.NAVIGATION_DELETED,
      entityType: "navigation",
      entityId: id,
      metadata: { deleted: deletedRows.length, docIds },
    });
    return { deleted: deletedRows.length };
  });
}

/** Restores a soft-deleted node and its subtree. */
export async function restoreNode(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.NAV_UPDATE);
  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(navigation).where(eq(navigation.id, id)).limit(1);
    if (!node) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);

    const restored = await tx.execute(sql`
      UPDATE documentation.navigation
      SET deleted_at = NULL, updated_by = ${actor.id}
      WHERE id = ${id} OR path <@ ${node.path}::ltree
      RETURNING id, document_id
    `);
    const docIds = (restored as unknown as Array<{ document_id: string | null }>)
      .map((r) => r.document_id)
      .filter((d): d is string => !!d);
    if (docIds.length > 0) {
      await tx
        .update(documents)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(sql`${documents.id} IN (${sql.join(docIds.map((d) => sql`${d}`), sql`, `)})`);
    }
    await logAudit(actor, { action: AUDIT_ACTIONS.NAVIGATION_RESTORED, entityType: "navigation", entityId: id });
  });
}

/** Hard delete — permanently removes the node, subtree, and linked documents. */
export async function hardDeleteNode(actor: Actor, id: string): Promise<void> {
  requirePermission(actor, PERMISSIONS.NAV_DELETE);
  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(navigation).where(eq(navigation.id, id)).limit(1);
    if (!node) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);

    const doomed = await tx.execute(sql`
      SELECT id, document_id FROM documentation.navigation
      WHERE id = ${id} OR path <@ ${node.path}::ltree
    `);
    const rows = doomed as unknown as Array<{ id: string; document_id: string | null }>;
    const docIds = rows.map((r) => r.document_id).filter((d): d is string => !!d);
    if (docIds.length > 0) {
      await tx.delete(documents).where(sql`${documents.id} IN (${sql.join(docIds.map((d) => sql`${d}`), sql`, `)})`);
    }
    await tx.delete(navigation).where(
      sql`${navigation.id} IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`,
    );
    await logAudit(actor, { action: "NAVIGATION_HARD_DELETED", entityType: "navigation", entityId: id });
  });
}

/**
 * Moves a node (reorder or re-parent) in one transaction:
 * lock → cycle check → new sort_key → path rewrite for the subtree.
 */
export async function moveNode(actor: Actor, id: string, input: MoveNodeInput): Promise<NavigationRow> {
  requirePermission(actor, PERMISSIONS.NAV_UPDATE);
  const newParentId = input.parentId ?? null;

  return db.transaction(async (tx) => {
    const [node] = await tx.select().from(navigation).where(eq(navigation.id, id)).for("update").limit(1);
    if (!node) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);
    if (node.deletedAt) throw new ApiError(NAV_DELETED, "Item is in trash", 409);

    let parentPath: string | null = null;
    if (newParentId) {
      const [parent] = await tx.select().from(navigation).where(eq(navigation.id, newParentId)).for("update").limit(1);
      if (!parent) throw new ApiError(NAV_PARENT_NOT_FOUND, "Target folder not found", 404);
      if (parent.deletedAt) throw new ApiError(NAV_DELETED, "Target folder is in trash", 409);

      // Cycle check: the new parent must not be the node itself or a
      // descendant of it (mirrors `parent.path <@ node.path`).
      const nodeLabels = node.path.split(".");
      const parentLabels = parent.path.split(".");
      const isSelfOrDescendant =
        parentLabels.length >= nodeLabels.length && nodeLabels.every((l, i) => parentLabels[i] === l);
      if (isSelfOrDescendant) {
        throw new ApiError(CYCLE_NOT_ALLOWED, "Cannot move an item into itself or one of its descendants", 409);
      }
      parentPath = parent.path;
    }

    const newPath = nodePath(parentPath, node.id);
    const { key } = await computeSortKey(tx, newParentId, id, input.prevId, input.nextId);

    const [updated] = await tx
      .update(navigation)
      .set({
        parentId: newParentId,
        path: sql`${newPath}::ltree`,
        sortKey: key,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(navigation.id, id))
      .returning();

    // Rewrite the materialized path for every descendant in one statement.
    if (node.path !== newPath) {
      await tx.execute(sql`
        UPDATE documentation.navigation
        SET path = ${newPath}::ltree || subpath(path, nlevel(${node.path}::ltree)),
            updated_at = now(),
            updated_by = ${actor.id}
        WHERE path <@ ${node.path}::ltree AND id <> ${id}
      `);
    }

    await logAudit(actor, {
      action: AUDIT_ACTIONS.NAVIGATION_MOVED,
      entityType: "navigation",
      entityId: id,
      metadata: { parentId: newParentId, oldPath: node.path, newPath },
    });
    return updated;
  });
}

/** Deep-copies a node and its subtree (documents are copied as new drafts). */
export async function duplicateNode(actor: Actor, id: string): Promise<NavigationRow> {
  requirePermission(actor, PERMISSIONS.NAV_CREATE);
  return db.transaction(async (tx) => {
    const [source] = await tx.select().from(navigation).where(eq(navigation.id, id)).limit(1);
    if (!source) throw new ApiError(NAV_NOT_FOUND, "Navigation item not found", 404);

    const copyDoc = async (documentId: string | null, title: string): Promise<string | null> => {
      if (!documentId) return null;
      const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      if (!doc) return null;
      const [copy] = await tx
        .insert(documents)
        .values({
          title: doc.title,
          content: doc.content,
          contentText: doc.contentText,
          status: "DRAFT",
          currentVersion: 1,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: documents.id });
      return copy.id;
    };

    const copySubtree = async (parentId: string | null, sourceId: string): Promise<string> => {
      const [src] = await tx.select().from(navigation).where(eq(navigation.id, sourceId)).limit(1);
      const parentPath = await findParentPath(tx, parentId);
      const newDocId = await copyDoc(src.documentId, src.title);
      const slug = await uniqueSlug(tx, parentId, `${src.slug}-copy`);

      const { key } = await computeSortKey(tx, parentId, null, null, null);
      const [inserted] = await tx
        .insert(navigation)
        .values({
          parentId,
          path: nodePath(parentPath, "placeholder"),
          type: src.type,
          title: `${src.title} (copy)`,
          slug,
          documentId: newDocId,
          linkUrl: src.linkUrl,
          description: src.description,
          sortKey: key,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      const realPath = nodePath(parentPath, inserted.id);
      await tx.update(navigation).set({ path: sql`${realPath}::ltree` }).where(eq(navigation.id, inserted.id));

      const children = await tx
        .select({ id: navigation.id })
        .from(navigation)
        .where(eq(navigation.parentId, src.id))
        .orderBy(asc(navigation.sortKey));
      for (const child of children) {
        await copySubtree(inserted.id, child.id);
      }
      return inserted.id;
    };

    const newId = await copySubtree(source.parentId, source.id);
    await logAudit(actor, { action: "NAVIGATION_DUPLICATED", entityType: "navigation", entityId: newId, metadata: { sourceId: id } });
    const [newNode] = await tx.select().from(navigation).where(eq(navigation.id, newId)).limit(1);
    return newNode;
  });
}

/** Resolves a document node by its slug chain, e.g. ["architecture", "frontend"]. */
export async function findBySlugPath(actor: Actor, slugs: string[]): Promise<NavigationRow | null> {
  requirePermission(actor, PERMISSIONS.READ);
  if (slugs.length === 0) return null;
  const rows = await db
    .select({ id: navigation.id, parentId: navigation.parentId, slug: navigation.slug })
    .from(navigation)
    .where(isNull(navigation.deletedAt));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const row of rows) {
    if (row.slug !== slugs[slugs.length - 1]) continue;
    // Walk ancestors via parentId and compare with the requested chain.
    const chain: string[] = [];
    let cur: (typeof rows)[number] | undefined = row;
    while (cur) {
      chain.unshift(cur.slug);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    if (chain.length === slugs.length && chain.every((s, i) => s === slugs[i])) {
      return (await db.select().from(navigation).where(eq(navigation.id, row.id)).limit(1))[0] ?? null;
    }
  }
  return null;
}

/**
 * Seed helper — builds a nested tree under root in one transaction.
 * Intended for the seed script and tests; takes a fully-privileged actor.
 */
export interface SeedNode {
  title: string;
  slug: string;
  type: NavType;
  documentId?: string | null;
  linkUrl?: string | null;
  children?: SeedNode[];
}

export async function createNavigationTree(
  actor: Actor,
  nodes: SeedNode[],
  opts: { audit?: boolean; log?: (msg: string) => void } = {},
): Promise<void> {
  const log = opts.log ?? (() => {});
  await db.transaction(async (tx) => {
    const insert = async (parentId: string | null, parentPath: string | null, node: SeedNode) => {
      const { key } = await computeSortKey(tx, parentId, null, null, null);
      const [inserted] = await tx
        .insert(navigation)
        .values({
          parentId,
          path: nodePath(parentPath, "placeholder"),
          type: node.type,
          title: node.title,
          slug: node.slug,
          documentId: node.documentId ?? null,
          linkUrl: node.linkUrl ?? null,
          sortKey: key,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      const realPath = nodePath(parentPath, inserted.id);
      await tx.update(navigation).set({ path: sql`${realPath}::ltree` }).where(eq(navigation.id, inserted.id));
      log(`  created ${node.type.toLowerCase()} "${node.title}"`);
      for (const child of node.children ?? []) {
        await insert(inserted.id, realPath, child);
      }
    };
    for (const node of nodes) {
      await insert(null, null, node);
    }
  });
  if (opts.audit) {
    await logAudit(actor, { action: AUDIT_ACTIONS.NAVIGATION_CREATED, entityType: "navigation", entityId: "seed" });
  }
}

/** Resolves a node's URL slug chain, e.g. ["architecture", "frontend"]. */
export async function getSlugPath(actor: Actor, nodeId: string): Promise<string> {
  requirePermission(actor, PERMISSIONS.READ);
  const rows = await db
    .select({ id: navigation.id, slug: navigation.slug, path: navigation.path })
    .from(navigation)
    .where(isNull(navigation.deletedAt));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const [node] = rows.filter((r) => r.id === nodeId);
  if (!node) return nodeId;
  const ids = node.path.split(".").map((l) => l.replace(/_/g, "-"));
  return ids.map((id) => byId.get(id)?.slug ?? id).join("/");
}

export type { NewNavigation };
export { slugify, toTree };
