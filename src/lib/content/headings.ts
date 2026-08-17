import type { TiptapDocument, TiptapNode } from "@/types/editor";

export interface HeadingItem {
  /** Stable anchor id — must match the id assigned to the rendered heading element. */
  id: string;
  text: string;
  level: number;
}

/** Slugifies heading text into a DOM-safe anchor id (dedupe handled by extractHeadings). */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "heading"
  );
}

function collectText(node: TiptapNode): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(collectText).join("");
}

/**
 * Walks a Tiptap JSON document and returns its headings in document order,
 * each with a unique, slugified anchor id. The reader's "On This Page" panel
 * is generated from this list — it is never stored or edited manually, so it
 * always reflects the document's current content.
 */
export function extractHeadings(doc: TiptapDocument | null | undefined): HeadingItem[] {
  if (!doc?.content) return [];
  const items: HeadingItem[] = [];
  const counts = new Map<string, number>();

  const walk = (nodes: TiptapNode[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "heading") {
        const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
        const text = collectText(node).trim();
        if (text) {
          const base = slugifyHeading(text);
          const count = counts.get(base) ?? 0;
          counts.set(base, count + 1);
          items.push({ id: count === 0 ? base : `${base}-${count + 1}`, text, level });
        }
      }
      walk(node.content);
    }
  };

  walk(doc.content);
  return items;
}
