"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { contentColumnClass, buildEditorExtensions, proseClass } from "./editor-config";
import { EditorBubbleMenu } from "./BubbleMenu";
import { SlashCommand } from "./SlashCommand";
import { SaveStatus } from "./SaveStatus";
import { DraftRecoveryDialog, type DraftRecoveryChoice } from "./DraftRecoveryDialog";
import { STORAGE_KEYS, getItem, setItem, removeItem, type EditorDraft } from "@/lib/storage/local-storage";
import { Api, ClientError } from "@/lib/api/client";
import type { SaveStatus as Status } from "@/types";
import type { TiptapDocument } from "@/types/editor";

const AUTOSAVE_DEBOUNCE_MS = 1200;
const DRAFT_DEBOUNCE_MS = 400;

export interface DocumentEditorProps {
  documentId: string;
  initialTitle: string;
  initialContent: TiptapDocument;
  serverUpdatedAt: string;
  canEdit: boolean;
  onTitleChange?: (title: string) => void;
}

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  serverUpdatedAt,
  canEdit,
  onTitleChange,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<Status>("idle");
  const [draftPrompt, setDraftPrompt] = useState<{ kind: "unchanged" | "conflict" } | null>(null);

  const draftKey = STORAGE_KEYS.editorDraft(documentId);
  const positionKey = STORAGE_KEYS.editorLastPosition(documentId);

  const dirtyRef = useRef(false);
  const statusRef = useRef<Status>("idle");
  const contentRef = useRef<TiptapDocument>(initialContent);
  const titleRef = useRef(initialTitle);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedUpdatedAtRef = useRef(serverUpdatedAt);

  const setStatusSafe = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const persistDraft = useCallback(
    (content: TiptapDocument, t: string) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        setItem<EditorDraft>(draftKey, {
          content,
          title: t,
          savedServerUpdatedAt: savedUpdatedAtRef.current,
          savedAt: Date.now(),
        });
      }, DRAFT_DEBOUNCE_MS);
    },
    [draftKey],
  );

  const saveNow = useCallback(
    async (content: TiptapDocument, t: string) => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setStatusSafe("saving");
      try {
        const updated = await Api.updateDocument(documentId, { title: t, content });
        savedUpdatedAtRef.current = updated.updatedAt;
        setItem<EditorDraft>(draftKey, {
          content,
          title: t,
          savedServerUpdatedAt: updated.updatedAt,
          savedAt: Date.now(),
        });
        setStatusSafe("saved");
        onTitleChange?.(t);
      } catch (err) {
        dirtyRef.current = true;
        setStatusSafe("failed");
        toast.error(err instanceof ClientError ? err.message : "Autosave failed");
      }
    },
    [documentId, draftKey, onTitleChange],
  );

  const scheduleSave = useCallback(
    (content: TiptapDocument, t: string) => {
      dirtyRef.current = true;
      contentRef.current = content;
      titleRef.current = t;
      if (statusRef.current !== "saving") setStatusSafe("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void saveNow(content, t), AUTOSAVE_DEBOUNCE_MS);
    },
    [saveNow],
  );

  const editor = useEditor({
    extensions: buildEditorExtensions("Start typing… use “/” for commands"),
    content: initialContent,
    editable: canEdit,
    editorProps: {
      attributes: { class: "outline-none" },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TiptapDocument;
      persistDraft(json, titleRef.current);
      scheduleSave(json, titleRef.current);
      // remember caret position (throttled)
      try {
        const pos = editor.state.selection.from;
        setItem(positionKey, { pos, at: Date.now() });
      } catch {
        // ignore
      }
    },
  });

  // Restore caret position from the last session.
  useEffect(() => {
    if (!editor) return;
    const last = getItem<{ pos: number }>(positionKey);
    if (last && typeof last.pos === "number" && last.pos <= editor.state.doc.content.size) {
      editor.commands.setTextSelection(last.pos);
    }
  }, [editor, positionKey]);

  // Draft recovery on mount (§21).
  useEffect(() => {
    if (!editor) return;
    const draft = getItem<EditorDraft>(draftKey);
    if (!draft || !draft.content) return;
    const serverJson = JSON.stringify(initialContent);
    const draftJson = JSON.stringify(draft.content);
    if (draftJson === serverJson) {
      // Draft matches the server — nothing to recover.
      removeItem(draftKey);
      return;
    }
    if (draft.savedServerUpdatedAt === serverUpdatedAt) {
      setDraftPrompt({ kind: "unchanged" });
    } else {
      setDraftPrompt({ kind: "conflict" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function handleDraftChoice(choice: DraftRecoveryChoice) {
    setDraftPrompt(null);
    if (choice === "draft") {
      const draft = getItem<EditorDraft>(draftKey);
      if (draft?.content && editor) {
        editor.commands.setContent(draft.content as TiptapDocument);
        contentRef.current = draft.content as TiptapDocument;
        if (draft.title) setTitle(draft.title);
        dirtyRef.current = true;
        setStatusSafe("unsaved");
        scheduleSave(draft.content as TiptapDocument, draft.title ?? titleRef.current);
      }
    } else {
      removeItem(draftKey);
    }
  }

  // Flush pending changes on unload.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) {
        try {
          navigator.sendBeacon(
            `/api/documents/${documentId}`,
            new Blob([JSON.stringify({ title: titleRef.current, content: contentRef.current })], { type: "application/json" }),
          );
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [documentId]);

  const dirty = status === "unsaved" || status === "failed" || status === "saving";

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-[680px] px-8 pb-2 pt-8">
        <div className="flex items-center gap-3">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              titleRef.current = e.target.value;
              if (e.target.value !== initialTitle) scheduleSave(contentRef.current, e.target.value);
              onTitleChange?.(e.target.value);
            }}
            disabled={!canEdit}
            placeholder="Untitled document"
            className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 disabled:opacity-100"
            aria-label="Document title"
          />
        </div>
        <div className="mt-1 flex h-5 items-center">
          <SaveStatus status={status} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {editor && (
          <>
            <EditorContent editor={editor} className={`${contentColumnClass} ${proseClass}`} />
            {canEdit && <EditorBubbleMenu editor={editor} />}
            {canEdit && <SlashCommand editor={editor} />}
          </>
        )}
      </div>
      <DraftRecoveryDialog open={draftPrompt !== null} kind={draftPrompt?.kind ?? null} onChoose={handleDraftChoice} />
      <span className="sr-only" aria-live="polite">{dirty ? "Unsaved changes" : ""}</span>
    </div>
  );
}
