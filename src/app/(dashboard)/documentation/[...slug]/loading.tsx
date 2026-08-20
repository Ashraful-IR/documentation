import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton shown while the documentation page is being fetched.
 * Renders inside the AppShell layout (sidebar + header are already visible).
 * Mirrors the three-panel reader layout: center content + right TOC.
 */
export default function DocumentationLoading() {
  return (
    <div className="min-h-full">
      <div className="flex w-full items-start gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-8 lg:py-10">
        {/* Center column — mirrors the article area */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[820px]">
            {/* Breadcrumb skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-3" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-3" />
              <Skeleton className="h-3.5 w-28" />
            </div>

            {/* Title skeleton */}
            <Skeleton className="mt-4 h-9 w-3/4" />

            {/* Meta info skeleton */}
            <div className="mt-3 flex items-center gap-4">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </div>

            {/* Content skeleton — paragraph blocks */}
            <div className="mt-8 space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />

              {/* Code block skeleton */}
              <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                <Skeleton className="h-3 w-16 mb-3" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="mt-2 h-3.5 w-4/5" />
                <Skeleton className="mt-2 h-3.5 w-2/3" />
              </div>

              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />

              {/* Another content block */}
              <div className="mt-6">
                <Skeleton className="h-6 w-48 mb-3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/5" />
              </div>

              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Child pages skeleton */}
            <div className="mt-12">
              <Skeleton className="h-3 w-28 mb-3" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </div>

            {/* Prev/Next navigation skeleton */}
            <div className="mt-8 flex flex-col gap-3 border-t pt-6 sm:mt-12 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
              <Skeleton className="h-16 w-full rounded-lg sm:w-[45%]" />
              <Skeleton className="h-16 w-full rounded-lg sm:w-[45%]" />
            </div>
          </div>
        </div>

        {/* Right column — On This Page skeleton (desktop only) */}
        <div className="sticky top-0 hidden w-80 shrink-0 lg:block">
          <Skeleton className="mb-3 h-3.5 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="ml-3 h-3 w-3/4" />
            <Skeleton className="ml-3 h-3 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="ml-3 h-3 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
