import type { TiptapJson, TiptapNode } from "@/db/schema";

/**
 * Walks a Tiptap JSON document and extracts its plain text.
 * Block-level nodes are separated by newlines so headings and paragraphs
 * read naturally in search snippets and in the `content_text` column.
 */
export function extractTextFromDoc(doc: TiptapJson | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (nodes: TiptapNode[] | undefined, blockLevel: boolean) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "text") {
        parts.push(node.text ?? "");
        continue;
      }
      const isBlock = !["textStyle", "link", "bold", "italic", "underline", "strike", "code", "highlight", "color"].includes(
        node.type,
      );
      walk(node.content, isBlock);
      if (isBlock) parts.push("\n");
    }
  };
  walk(doc.content, true);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}
