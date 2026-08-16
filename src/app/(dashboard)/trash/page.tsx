"use client";

import { useEffect, useState } from "react";
import { EyeOff, Folder, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Api, ClientError } from "@/lib/api/client";
import { useNavigation } from "@/hooks/useNavigation";
import type { NavigationNode } from "@/types";

function flattenDeleted(nodes: NavigationNode[]): Array<NavigationNode & { path: string }> {
  const out: Array<NavigationNode & { path: string }> = [];
  const walk = (list: NavigationNode[], path: string[]) => {
    for (const n of list) {
      out.push({ ...n, path: [...path, n.title].join(" / ") });
      walk(n.children, [...path, n.title]);
    }
  };
  walk(nodes, []);
  return out;
}

export default function TrashPage() {
  const { tree, refresh, deleteNode, restoreNode } = useNavigation();
  const [trash, setTrash] = useState<NavigationNode[]>([]);
  const [hidden, setHidden] = useState<NavigationNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [t, h] = await Promise.all([Api.getTrash(), Api.getTree()]);
        setTrash(t);
        setHidden(h);
      } catch (err) {
        toast.error(err instanceof ClientError ? err.message : "Failed to load trash");
      } finally {
        setLoading(false);
      }
    })();
  }, [tree]);

  const deletedRows = flattenDeleted(trash);
  const hiddenRows = flattenDeleted(hidden.filter((n) => !n.isVisible || n.effectivelyHidden));

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Trash & hidden</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Deleted items are soft-deleted and fully recoverable. Hidden items are excluded from the sidebar.
      </p>

      <Tabs defaultValue="deleted" className="mt-6">
        <TabsList>
          <TabsTrigger value="deleted">Deleted ({deletedRows.length})</TabsTrigger>
          <TabsTrigger value="hidden">Hidden ({hiddenRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="deleted" className="mt-4">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : deletedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the trash.</p>
          ) : (
            <ul className="space-y-2">
              {deletedRows.map((node) => (
                <li key={node.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{node.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{node.path}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      await restoreNode(node.id);
                      toast.success("Restored");
                    }}
                  >
                    <RotateCcw className="size-3.5" /> Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!window.confirm(`Permanently delete “${node.title}” and everything inside it? This cannot be undone.`)) return;
                      await deleteNode(node.id, true);
                      toast.success("Permanently deleted");
                    }}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          {hiddenRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hidden items.</p>
          ) : (
            <ul className="space-y-2">
              {hiddenRows.map((node) => (
                <li key={node.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <EyeOff className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{node.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{node.path}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      await refresh();
                      await Api.updateNode(node.id, { isVisible: true });
                      toast.success("Now visible");
                    }}
                  >
                    <EyeOff className="size-3.5" /> Show
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
