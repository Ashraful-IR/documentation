"use client";

import { useEffect, useRef, useState } from "react";

import type { HeadingItem } from "@/lib/content/headings";
import { cn } from "@/lib/utils";

function findScrollContainer(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return window;
}

export function OnThisPage({ items, className }: { items: HeadingItem[]; className?: string }) {
  const asideRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLElement | Window | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const minLevel = Math.min(...items.map((i) => i.level));

  // Locate the scroll container (the app shell's <main>) and keep the active
  // heading in sync with the scroll position.
  useEffect(() => {
    const container = findScrollContainer(asideRef.current);
    containerRef.current = container;

    const updateActive = () => {
      const c = containerRef.current;
      if (!c) return;
      const containerTop =
        c instanceof HTMLElement ? c.getBoundingClientRect().top : 0;
      const threshold = containerTop + 96; // keep the heading clear of the top edge
      let current: string | null = null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= threshold) current = item.id;
      }
      setActiveId(current ?? items[0]?.id ?? null);
    };

    // Headings are stamped with ids by DocumentViewer after the editor mounts —
    // poll briefly until they exist, then start tracking.
    let tries = 0;
    const waitForHeadings = () => {
      if (document.getElementById(items[0]?.id ?? "") || tries > 60) {
        updateActive();
        container.addEventListener("scroll", updateActive, { passive: true });
        window.addEventListener("resize", updateActive);
      } else {
        tries += 1;
        requestAnimationFrame(waitForHeadings);
      }
    };
    waitForHeadings();

    return () => {
      container.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [items]);

  function scrollToHeading(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <aside ref={asideRef} className={cn("pt-6", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On This Page</p>
      <nav className="mt-3" aria-label="On this page">
        <ul className="space-y-1 border-l border-border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToHeading(item.id)}
                style={{ paddingLeft: 12 + (item.level - minLevel) * 12 }}
                className={cn(
                  "-ml-px block w-full border-l py-1 pr-2 text-left text-[13px] leading-snug transition-colors",
                  activeId === item.id
                    ? "border-gp-green font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
