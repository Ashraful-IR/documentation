"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  /** Whether the overlay is visible. */
  visible: boolean;
  /** Message displayed below the spinner. */
  message?: string;
  /** Optional extra classes on the backdrop. */
  className?: string;
}

/**
 * Full-page blurred overlay that blocks all pointer interaction with the
 * background. Use for operations that genuinely need to block the entire UI
 * (e.g. authentication). For lighter operations prefer inline spinners or
 * skeletons instead.
 *
 * Works in both light and dark mode — the backdrop uses `bg-background/60`
 * which inherits the theme's background colour.
 */
export function LoadingOverlay({ visible, message, className }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message ?? "Loading"}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-background/60 backdrop-blur-sm",
        /* Block pointer events on everything behind the overlay */
        "pointer-events-auto",
        className,
      )}
    >
      <Loader2 className="size-8 animate-spin text-primary" />
      {message && (
        <p className="mt-3 text-sm font-medium text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
