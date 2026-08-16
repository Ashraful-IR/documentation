import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { documents, navigation } from "@/db/schema";
import { requirePermission, PERMISSIONS, type Actor } from "@/lib/auth/permissions";
import type { SearchResult } from "@/types";

/**
 * MVP search (§25): PostgreSQL full-text search with the GIN index from the
 * schema — no external search engine.
 */
export async function search(actor: Actor, query: string, limit = 20): Promise<SearchResult[]> {
  requirePermission(actor, PERMISSIONS.READ);
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Documents: title + content_text via the GIN index.
  const docRows = await db.execute(sql`
    SELECT id, title, content_text,
           ts_rank_cd(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_text,'')),
                      plainto_tsquery('english', ${q})) AS rank
    FROM documentation.documents
    WHERE deleted_at IS NULL
      AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_text,''))
          @@ plainto_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);
  for (const row of docRows as unknown as Array<{ id: string; title: string; content_text: string | null; rank: number }>) {
    const nav = await findNavForDocument(row.id);
    results.push({
      type: "document",
      id: row.id,
      title: row.title,
      excerpt: snippet(row.content_text ?? "", q),
      url: nav ? `/documentation/${nav.slugPath}` : `/editor/${row.id}`,
    });
  }

  // Navigation titles, slugs, descriptions.
  const navRows = await db.execute(sql`
    SELECT id, title, slug, description
    FROM documentation.navigation
    WHERE deleted_at IS NULL
      AND (title ILIKE ${`%${q}%`} OR slug ILIKE ${`%${q}%`} OR description ILIKE ${`%${q}%`})
    ORDER BY title
    LIMIT ${limit}
  `);
  for (const row of navRows as unknown as Array<{ id: string; title: string; slug: string; description: string | null }>) {
    if (results.some((r) => r.title === row.title)) continue;
    results.push({
      type: "navigation",
      id: row.id,
      title: row.title,
      excerpt: snippet(row.description ?? "", q),
      url: `/documentation/${row.slug}`,
    });
  }

  return results.slice(0, limit);
}

async function findNavForDocument(documentId: string): Promise<{ slugPath: string } | null> {
  const rows = await db
    .select({
      id: navigation.id,
      slug: navigation.slug,
      parentId: navigation.parentId,
      path: navigation.path,
    })
    .from(navigation)
    .where(and(isNull(navigation.deletedAt), eq(navigation.documentId, documentId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Resolve the slug chain via the ltree path's ancestor labels.
  const labels = row.path.split(".");
  const all = await db
    .select({ id: navigation.id, slug: navigation.slug, path: navigation.path })
    .from(navigation)
    .where(isNull(navigation.deletedAt));
  const byId = new Map(all.map((n) => [n.id, n]));
  const ids = labels.map((l) => l.replace(/_/g, "-"));
  const slugs = ids.map((id) => byId.get(id)?.slug ?? id);
  return { slugPath: slugs.join("/") };
}

function snippet(text: string, query: string, radius = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const idx = clean.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return clean.length > radius * 2 ? `${clean.slice(0, radius * 2)}…` : clean;
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + query.length + radius);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

