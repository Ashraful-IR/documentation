"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { TiptapDocument } from "@/types/editor";
import type { HeadingItem } from "@/lib/content/headings";

const DocumentViewer = dynamic(
  () => import("./DocumentViewer").then((m) => m.DocumentViewer),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 py-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    ),
  },
);

export function LazyDocumentViewer({
  content,
  headings,
  variant = "paper",
}: {
  content: TiptapDocument;
  headings?: HeadingItem[];
  variant?: "paper" | "reader";
}) {
  return <DocumentViewer content={content} headings={headings} variant={variant} />;
}
