import { isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { navigation } from "@/db/schema";
import { requirePermission, PERMISSIONS, type Actor } from "@/lib/auth/permissions";
import type { SearchResult } from "@/types";

/**
 * Search (§25): PostgreSQL full-text search with the GIN index from the
 * schema — no external search engine.
 *
 * Resolves nav slug chains in two batched queries instead of N+1.
 */
export async function search(actor: Actor, query: string, limit = 20): Promise<SearchResult[]> {
  requirePermission(actor, PERMISSIONS.READ);
  const q = query.trim();
  if (!q) return [];

  // ── Batch 1: full-text search on documents (GIN index) ──────────────
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
  const docHits = docRows as unknown as Array<{
    id: string; title: string; content_text: string | null; rank: number;
  }>;

  // ── Batch 2: all visible nav nodes (one query, cached for slug resolution) ──
  const allNav = await db
    .select({
      id: navigation.id,
      slug: navigation.slug,
      path: navigation.path,
      documentId: navigation.documentId,
    })
    .from(navigation)
    .where(isNull(navigation.deletedAt));

  // Build lookup maps for O(1) slug resolution.
  const navByDocId = new Map<string, (typeof allNav)[number]>();
  const navById = new Map<string, (typeof allNav)[number]>();
  for (const n of allNav) {
    navById.set(n.id, n);
    if (n.documentId) navByDocId.set(n.documentId, n);
  }

  const results: SearchResult[] = [];

  // Resolve document hits.
  for (const row of docHits) {
    const navNode = navByDocId.get(row.id);
    const slugPath = navNode ? buildSlugChain(navNode, navById) : null;
    results.push({
      type: "document",
      id: row.id,
      title: row.title,
      excerpt: snippet(row.content_text ?? "", q),
      url: slugPath ? `/documentation/${slugPath}` : `/editor/${row.id}`,
    });
  }

  // ── Batch 3: navigation title/slug/description search (ILIKE) ───────
  const navRows = await db.execute(sql`
    SELECT id, title, slug, description
    FROM documentation.navigation
    WHERE deleted_at IS NULL
      AND (title ILIKE ${`%${q}%`} OR slug ILIKE ${`%${q}%`} OR description ILIKE ${`%${q}%`})
    ORDER BY title
    LIMIT ${limit}
  `);
  for (const row of navRows as unknown as Array<{
    id: string; title: string; slug: string; description: string | null;
  }>) {
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

/**
 * Builds a slug chain for a nav node by walking its ltree path ancestors.
 * All lookups are O(1) via the preloaded navById map.
 */
function buildSlugChain(
  node: { path: string },
  navById: Map<string, { id: string; slug: string; path: string }>,
): string {
  const labels = node.path.split(".");
  const ids = labels.map((l) => l.replace(/_/g, "-"));
  return ids.map((id) => navById.get(id)?.slug ?? id).join("/");
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
