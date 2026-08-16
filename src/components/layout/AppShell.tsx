"use client";

import { useEffect, useState } from "react";
import { BookOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

import { useNavigation } from "@/hooks/useNavigation";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { Sidebar } from "@/components/navigation/Sidebar";
import { SearchCommand } from "./SearchCommand";
import { UserMenu } from "./UserMenu";

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const { tree, loading, createNode, updateNode, moveNode, deleteNode, duplicateNode } = useNavigation();
  // Sidebar always starts open; collapsing only lasts for the current session.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSm, setIsSm] = useState(true);
  const pathname = usePathname();

  // Track the breakpoint so the single open/close button knows which state
  // drives the sidebar on the current viewport.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsSm(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Close the mobile drawer on navigation and on Escape.
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

  // The toggle sits at the top-right edge of the sidebar itself. On desktop it
  // collapses the sidebar column; on mobile it opens/closes the overlay drawer.
  function toggleSidebar() {
    if (window.matchMedia("(min-width: 640px)").matches) {
      setSidebarCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }

  const sidebarOpen = isSm ? !sidebarCollapsed : mobileOpen;

  const sidebarProps = {
    tree,
    loading,
    role: user.role,
    mutations: { createNode, updateNode, moveNode, deleteNode, duplicateNode },
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar — no sidebar toggle here */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
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

      <div className="relative flex min-h-0 flex-1">
        {/* Floating re-open button — shown only when the sidebar is fully collapsed */}
        {!sidebarOpen && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1 z-10 size-9 rounded-md"
                  onClick={toggleSidebar}
                  aria-label="Show sidebar"
                >
                  <PanelLeftOpen className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Show sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Mobile drawer backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 transition-opacity sm:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Sidebar — always `relative` so the toggle anchors to its top-right edge;
            collapses fully (w-0) when closed; overlay drawer on mobile */}
        <aside
          className={cn(
            "relative flex shrink-0 flex-col overflow-hidden border-r bg-sidebar transition-all duration-200 ease-in-out",
            mobileOpen
              ? "fixed inset-y-0 left-0 z-50 w-72 shadow-xl sm:relative sm:inset-auto sm:z-auto sm:shadow-none"
              : "w-0 border-r-0",
            sidebarCollapsed ? "sm:w-0 sm:border-r-0" : "sm:w-72",
          )}
        >
          {/* Collapse button at the top-right edge of the sidebar */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1 z-10 size-9 rounded-md"
                  onClick={toggleSidebar}
                  aria-label="Hide sidebar"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Hide sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="min-w-0 flex-1 overflow-hidden">
            <Sidebar {...sidebarProps} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
