"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Rocket, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VersionHistory } from "@/components/documents/VersionHistory";
import { DocumentEditor, type EditorApi } from "./DocumentEditor";
import { Api, ClientError } from "@/lib/api/client";
import type { DocumentStatus } from "@/types";
import type { TiptapDocument } from "@/types/editor";

interface EditorWorkspaceProps {
  documentId: string;
  initialTitle: string;
  initialContent: TiptapDocument;
  serverUpdatedAt: string;
  status: DocumentStatus;
  currentVersion: number;
  backHref: string;
  canEdit: boolean;
  /** Server-computed: the working copy already differs from the published snapshot. */
  initialHasUnpublishedChanges: boolean;
}

/**
 * Client wrapper around the editor page: owns the app bar (Back, history,
 * Save version, Publish) and coordinates with the editor so that publishing
 * and checkpointing always flush pending edits first. Publishing shows a
 * confirmation dialog once the updated document is live.
 */
export function EditorWorkspace({
  documentId,
  initialTitle,
  initialContent,
  serverUpdatedAt,
  status,
  currentVersion,
  backHref,
  canEdit,
  initialHasUnpublishedChanges,
}: EditorWorkspaceProps) {
  const router = useRouter();
  const editorApiRef = useRef<EditorApi | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedDialogOpen, setPublishedDialogOpen] = useState(false);
  // Lights up the instant the working copy changes, and clears once published.
  const [unpublished, setUnpublished] = useState(initialHasUnpublishedChanges);

  /** Flush pending edits so the server has the latest draft. */
  const flushEditor = useCallback(async () => {
    const api = editorApiRef.current;
    if (!api) return true;
    const snapshot = await api.flush();
    return snapshot !== null;
  }, []);

  async function handleSaveVersion() {
    setSavingVersion(true);
    try {
      const flushed = await flushEditor();
      if (!flushed) return;
      await Api.checkpointDocument(documentId);
      toast.success("Version saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Failed to save version");
    } finally {
      setSavingVersion(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const flushed = await flushEditor();
      if (!flushed) return;
      await Api.publishDocument(documentId);
      router.refresh();
      setUnpublished(false);
      setPublishedDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* App bar — theme-aware, above the editor toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-6 md:gap-5 md:px-10">
        <Button asChild size="sm" className="gap-2 rounded-md border-2">
          <Link href={backHref}>
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </Button>
        <div className="flex-1" />
        <VersionHistory documentId={documentId} currentVersion={currentVersion} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void handleSaveVersion()}
          disabled={savingVersion || publishing}
        >
          {savingVersion ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          <span className="hidden sm:inline">Save version</span>
          <span className="sm:hidden">Save</span>
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => void handlePublish()}
          disabled={publishing || savingVersion}
        >
          {publishing ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
          <span className="hidden sm:inline">{publishing ? "Publishing…" : "Publish"}</span>
          <span className="sm:hidden">{publishing ? "…" : "Publish"}</span>
        </Button>
        <Badge variant={status === "PUBLISHED" ? "default" : "secondary"} className="hidden text-[10px] sm:inline-flex">
          {status}
        </Badge>
        {unpublished && (
          <Badge
            variant="outline"
            className="hidden border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400 sm:inline-flex"
            title="The published page still shows the previous version"
          >
            Unpublished changes
          </Badge>
        )}
      </div>

      <DocumentEditor
        documentId={documentId}
        initialTitle={initialTitle}
        initialContent={initialContent}
        serverUpdatedAt={serverUpdatedAt}
        canEdit={canEdit}
        apiRef={editorApiRef}
        onEditorChanged={() => setUnpublished(true)}
      />

      {/* Publish confirmation — shown after the updated document goes live */}
      <Dialog open={publishedDialogOpen} onOpenChange={setPublishedDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Document published</DialogTitle>
            <DialogDescription>
              Your changes are saved and the updated document is now live on the documentation site.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishedDialogOpen(false)}>
              Close
            </Button>
            <Button asChild onClick={() => setPublishedDialogOpen(false)}>
              <Link href={backHref}>View page</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
