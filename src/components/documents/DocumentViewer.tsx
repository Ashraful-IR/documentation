"use client";

import { EditorContent, useEditor } from "@tiptap/react";

import { contentColumnClass, buildEditorExtensions, proseClass } from "@/components/editor/editor-config";
import type { TiptapDocument } from "@/types/editor";

export function DocumentViewer({ content }: { content: TiptapDocument }) {
  const editor = useEditor({
    extensions: buildEditorExtensions(),
    content,
    editable: false,
    editorProps: {
      attributes: { class: "outline-none" },
    },
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className={contentColumnClass}>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <article className={contentColumnClass}>
      <EditorContent editor={editor} className={proseClass} />
    </article>
  );
}
