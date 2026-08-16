"use client";

import { EditorContent, useEditor } from "@tiptap/react";

import { documentBodyClass, buildEditorExtensions } from "@/components/editor/editor-config";
import type { TiptapDocument } from "@/types/editor";

export function DocumentViewer({ content, title }: { content: TiptapDocument; title?: string }) {
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
      <div className="min-h-full bg-muted py-10 text-center text-sm text-muted-foreground">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted">
      <div className="flex justify-center px-6 py-10">
        <article className="w-[820px] shrink-0 bg-white text-zinc-900 shadow-2xl">
          <div className="px-16 py-14">
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
