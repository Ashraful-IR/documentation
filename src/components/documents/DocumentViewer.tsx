"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { documentBodyClass, buildEditorExtensions } from "@/components/editor/editor-config";
import { slugifyHeading, type HeadingItem } from "@/lib/content/headings";
import { copyToClipboard } from "@/lib/copyToClipboard";
import type { TiptapDocument, TiptapNode } from "@/types/editor";

/**
 * Reader mode strips per-run text styling — the `textStyle` mark carries
 * hardcoded colors/fonts baked into content by DOCX imports or the editor
 * (e.g. Word's `color: black` / `#262626`). Rendering those inline styles in
 * dark mode makes text stay black on the dark background. The reader is
 * theme-aware, so it drops the mark and lets the app theme control text color.
 * The editor/paper view keeps the marks (Word colors are meaningful there).
 */
function stripInlineStyles(doc: TiptapDocument): TiptapDocument {
  const clone = structuredClone(doc);
  const walk = (node: TiptapNode) => {
    if (node.marks?.length) {
      node.marks = node.marks.filter((m) => m.type !== "textStyle");
    }
    node.content?.forEach(walk);
  };
  clone.content?.forEach(walk);
  return clone;
}

export function DocumentViewer({
  content,
  title,
  headings,
  variant = "paper",
}: {
  content: TiptapDocument;
  title?: string;
  /** Heading list whose ids get stamped onto the rendered <h1..h6> elements so
   *  the "On This Page" panel can deep-link and scroll-spy. Optional — previews
   *  (e.g. version history) render without anchors. */
  headings?: HeadingItem[];
  /** "paper" — the white document page (editor + version previews);
   *  "reader" — theme-aware content for the three-panel documentation reader. */
  variant?: "paper" | "reader";
}) {
  const editor = useEditor({
    extensions: buildEditorExtensions(),
    content: variant === "reader" ? stripInlineStyles(content) : content,
    editable: false,
    editorProps: {
      attributes: { class: "outline-none" },
    },
    immediatelyRender: false,
    // Read-only viewer: without this, every setContent transaction re-renders
    // the component and EditorContent re-creates the ProseMirror DOM, which
    // wipes the heading anchors and code-block chrome we stamp below.
    shouldRerenderOnTransaction: false,
  });

  // Keep the read-only view in sync when navigating between documents without a
  // full remount (e.g. clicking another page in the sidebar). ProseMirror
  // applies the transaction synchronously, so the DOM is current immediately
  // after setContent — heading anchors and code-block chrome are (re)stamped
  // right after, in the same effect.
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(variant === "reader" ? stripInlineStyles(content) : content);

    if (variant !== "reader") return;

    const dom = editor.view.dom;

    const stamp = () => {
      if (headings?.length) {
        // Match each rendered heading to its TOC anchor by its own text, using
        // the same slugify + dedupe as extractHeadings. Positional matching
        // breaks when the document contains empty headings: the DOM has one
        // element per heading, but the TOC list skips empty ones, which shifts
        // every id onto the wrong element (clicking "3.7" would find a heading
        // back in section "3").
        const counts = new Map<string, number>();
        dom.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((el) => {
          const text = el.textContent?.trim() ?? "";
          if (!text) return;
          const base = slugifyHeading(text);
          const count = counts.get(base) ?? 0;
          counts.set(base, count + 1);
          el.id = count === 0 ? base : `${base}-${count + 1}`;
        });
      }

      dom.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
        if (pre.dataset.readerDecorated === "1") return;
        pre.dataset.readerDecorated = "1";
        const code = pre.querySelector("code");
        const lang =
          pre.dataset.language ??
          code?.className.match(/language-([\w+-]+)/)?.[1] ??
          "code";
        const bar = document.createElement("div");
        bar.className = "reader-code-bar";
        const label = document.createElement("span");
        label.textContent = lang;
        const copy = document.createElement("button");
        copy.type = "button";
        copy.textContent = "Copy";
        copy.addEventListener("click", async () => {
          const text = code?.textContent ?? pre.textContent ?? "";
          const ok = await copyToClipboard(text);
          copy.textContent = ok ? "Copied!" : "Copy failed";
          setTimeout(() => {
            copy.textContent = "Copy";
          }, 1500);
        });
        bar.append(label, copy);
        pre.prepend(bar);
      });
    };

    stamp();

    // Tiptap can replace the ProseMirror DOM after our synchronous stamping
    // (deferred view renders), which would drop the anchors and code chrome.
    // Re-stamp whenever the DOM changes; stamp() is idempotent, so this is safe.
    const observer = new MutationObserver(() => stamp());
    observer.observe(dom, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [editor, content, variant, headings]);

  if (!editor) {
    return (
      <div
        className={
          variant === "reader"
            ? "py-6 text-sm text-muted-foreground"
            : "min-h-full bg-muted py-10 text-center text-sm text-muted-foreground"
        }
      >
        <p>Loading…</p>
      </div>
    );
  }

  if (variant === "reader") {
    return (
      <div className="reader-body">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted">
      <div className="flex justify-center px-2 py-4 sm:px-6 sm:py-10">
        <article className="w-full max-w-[820px] shrink-0 bg-white text-zinc-900 shadow-2xl">
          <div className="px-6 py-8 sm:px-10 sm:py-10 md:px-16 md:py-14">
            {/* Page header — same chrome as the editor */}
            <div className="mb-10 flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground">Documentation Platform</span>
              <span className="text-[10px] font-semibold tracking-[0.25em] text-muted-foreground">DOC EDITOR</span>
            </div>

            {title && <h1 className="mb-8 text-2xl font-bold leading-tight tracking-tight text-zinc-900">{title}</h1>}

            <EditorContent editor={editor} className={documentBodyClass} />
          </div>
        </article>
      </div>
    </div>
  );
}
