"use client";

import { Check, CloudUpload, TriangleAlert } from "lucide-react";

import type { SaveStatus as Status } from "@/types";

export function SaveStatus({ status }: { status: Status }) {
  if (status === "idle") return null;
  const config: Record<Status, { icon: React.ReactNode; label: string; className: string } | null> = {
    idle: null,
    saving: { icon: <CloudUpload className="size-3 animate-pulse" />, label: "Saving…", className: "text-muted-foreground" },
    saved: { icon: <Check className="size-3" />, label: "Saved", className: "text-emerald-600 dark:text-emerald-400" },
    unsaved: { icon: <TriangleAlert className="size-3" />, label: "Unsaved changes", className: "text-amber-600 dark:text-amber-400" },
    failed: { icon: <TriangleAlert className="size-3" />, label: "Save failed", className: "text-destructive" },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${c.className}`} aria-live="polite">
      {c.icon}
      {c.label}
    </span>
  );
}
