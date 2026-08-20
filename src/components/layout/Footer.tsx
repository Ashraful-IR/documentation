import { cn } from "@/lib/utils";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/5 bg-background/5 backdrop-blur-sm",
        "px-3 py-2 sm:px-4 sm:py-3",
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        {/* Left / copyright */}
        <p className="text-xs text-text-muted">
          &copy; 2026 V2 Technologies Ltd. All rights reserved.
        </p>

        {/* Center / links */}
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-text-secondary">
          <span>Technical Documentation</span>
          <span aria-hidden="true" className="text-text-disabled">&bull;</span>
          <span>System Architecture</span>
          <span aria-hidden="true" className="text-text-disabled">&bull;</span>
          <span>API Reference</span>
          <span aria-hidden="true" className="text-text-disabled">&bull;</span>
          <span>Developer Guides</span>
        </p>

        {/* Right / maintained-by */}
        <p className="text-xs text-text-muted">
          Developed By MD ASHRAFUL ISLAM.
        </p>
      </div>
    </footer>
  );
}
