"use client";

import { useEffect, useState } from "react";
import { BookOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { useNavigation } from "@/hooks/useNavigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/storage/local-storage";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { Sidebar } from "@/components/navigation/Sidebar";
import { SearchCommand } from "./SearchCommand";
import { UserMenu } from "./UserMenu";

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const { tree, loading, createNode, updateNode, moveNode, deleteNode, duplicateNode } = useNavigation();
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage<boolean>(STORAGE_KEYS.sidebarCollapsed, false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // ChatGPT-style toggle: one button at the top-left. On desktop it collapses
  // the sidebar column; on mobile it slides the sidebar in as an overlay.
  // Close the overlay on navigation and on Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggleSidebar() {
    if (window.matchMedia("(min-width: 640px)").matches) {
      setSidebarCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }

  const sidebarProps = {
    tree,
    loading,
    role: user.role,
    mutations: { createNode, updateNode, moveNode, deleteNode, duplicateNode },
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
                aria-pressed={sidebarCollapsed || mobileOpen}
              >
                <PanelLeftOpen className="size-4 sm:hidden" />
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="hidden size-4 sm:block" />
                ) : (
                  <PanelLeftClose className="hidden size-4 sm:block" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Link href="/documentation" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
            <BookOpen className="size-3.5" />
          </div>
          <span className="hidden text-sm font-semibold tracking-tight md:inline">Documentation</span>
        </Link>
        <div className="flex-1" />
        <SearchCommand />
        <UserMenu user={user} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mobile drawer backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity sm:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        {/* Sidebar: desktop column (collapses to 0 width) / mobile overlay drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 overflow-hidden border-r bg-sidebar shadow-xl transition-all duration-200 ease-in-out sm:static sm:inset-auto sm:z-auto sm:shadow-none",
            mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full sm:visible sm:translate-x-0",
            sidebarCollapsed ? "sm:w-0 sm:border-r-0" : "sm:w-72",
          )}
        >
          <div className="h-full w-72">
            <Sidebar {...sidebarProps} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
