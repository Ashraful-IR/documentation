"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Api } from "@/lib/api/client";
import type { SearchResult } from "@/types";

export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await Api.search(query));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function go(result: SearchResult) {
    setOpen(false);
    router.push(result.url);
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-56 justify-start gap-2 text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left text-sm">Search documentation…</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Search documents and navigation…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && <CommandEmpty>Searching…</CommandEmpty>}
            {!loading && results.length === 0 && query.trim() && <CommandEmpty>No results for “{query}”</CommandEmpty>}
            {!query.trim() && <CommandEmpty>Type to search titles and content.</CommandEmpty>}
            <CommandGroup heading="Results">
              {results.map((r) => (
                <CommandItem key={`${r.type}-${r.id}`} value={r.title} onSelect={() => go(r)}>
                  <FileText className="size-3.5" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.title}</div>
                    {r.excerpt && <div className="truncate text-xs text-muted-foreground">{r.excerpt}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
