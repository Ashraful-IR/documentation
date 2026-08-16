import { BookOpen, ExternalLink, FileText, Folder } from "lucide-react";
import Link from "next/link";

import { getSessionUser } from "@/lib/auth/actor";
import { getTree } from "@/services/navigation.service";

export const dynamic = "force-dynamic";

export default async function DocumentationLanding() {
  const user = await getSessionUser();
  const tree = user ? await getTree({ id: user.id, role: user.role }) : [];
  const roots = tree.filter((n) => n.parentId === null);

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-14">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
          <BookOpen className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Pick a document from the sidebar, or create a new page.
          </p>
        </div>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No documentation yet. Use the <span className="font-medium text-foreground">+</span> button in the sidebar to
            add a folder or page.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roots.map((node) => {
            const href =
              node.type === "LINK"
                ? node.linkUrl ?? "#"
                : node.type === "FOLDER"
                  ? "#"
                  : `/documentation/${node.slug}`;
            const Icon = node.type === "FOLDER" ? Folder : node.type === "LINK" ? ExternalLink : FileText;
            return (
              <Link
                key={node.id}
                href={href}
                target={node.type === "LINK" ? "_blank" : undefined}
                className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/50"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{node.title}</p>
                  {node.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{node.description}</p>
                  )}
                  {node.type === "FOLDER" && node.children.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{node.children.length} item(s) inside</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
