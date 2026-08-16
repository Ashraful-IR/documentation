"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Api, ClientError } from "@/lib/api/client";
import type { AuditLogEntry } from "@/types";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.listAudit(300)
      .then(setLogs)
      .catch((err) => toast.error(err instanceof ClientError ? err.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every mutating action, in order.</p>

      <ScrollArea className="mt-6 h-[70vh] rounded-lg border">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {log.entityType}:{log.entityId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">{log.user?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </div>
  );
}
