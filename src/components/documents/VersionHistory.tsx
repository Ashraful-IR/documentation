"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Api, ClientError } from "@/lib/api/client";
import type { DocumentVersionSummary } from "@/types";
import type { TiptapDocument } from "@/types/editor";
import { DocumentViewer } from "./DocumentViewer";

interface VersionHistoryProps {
  documentId: string;
  currentVersion: number;
  /** Extra classes merged onto the trigger button (e.g. for dark editor chrome). */
  triggerClassName?: string;
}

export function VersionHistory({ documentId, currentVersion, triggerClassName }: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ versionNumber: number; content: TiptapDocument } | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setVersions(await Api.listVersions(documentId));
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }

  async function openPreview(versionNumber: number) {
    try {
      const v = await Api.getVersion(documentId, versionNumber);
      setPreview({ versionNumber, content: v.content as TiptapDocument });
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Failed to load version");
    }
  }

  async function restore(versionNumber: number) {
    setRestoring(true);
    try {
      await Api.restoreVersion(documentId, versionNumber);
      toast.success(`Restored v${versionNumber}`);
      setPreview(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <Sheet onOpenChange={(open) => open && void load()}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className={`gap-1.5 text-muted-foreground ${triggerClassName ?? ""}`}>
            <History className="size-3.5" /> History
          </Button>
        </SheetTrigger>
        <SheetContent className="w-80 sm:w-96">
          <SheetHeader>
            <SheetTitle>Version history</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pr-4">
            <div className="space-y-1 py-4">
              {loading && <Skeleton className="h-10 w-full" />}
              {!loading && versions.length === 0 && (
                <p className="text-sm text-muted-foreground">No versions yet. Publish to snapshot one.</p>
              )}
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => void openPreview(v.versionNumber)}
                  className="flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</span>
                  </div>
                  {v.changeSummary && <span className="truncate text-xs text-muted-foreground">{v.changeSummary}</span>}
                  {v.versionNumber === currentVersion && (
                    <span className="mt-1 w-fit rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      current
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>Version v{preview.versionNumber}</DialogTitle>
                <DialogDescription>Preview of this version&apos;s content.</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/30 px-2 py-1">
                <DocumentViewer content={preview.content} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => void restore(preview.versionNumber)}
                  disabled={restoring}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  {restoring ? "Restoring…" : "Restore this version"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
