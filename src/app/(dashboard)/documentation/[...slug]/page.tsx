import { ArrowLeft, ArrowRight, ChevronRight, FileText, Folder, Home, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { OnThisPage } from "@/components/documents/OnThisPage";
import { extractHeadings } from "@/lib/content/headings";
import { getSessionUser } from "@/lib/auth/actor";
import { findBySlugPath, getTree } from "@/services/navigation.service";
import { getDocument } from "@/services/document.service";
import { getUserById } from "@/services/user.service";
import type { NavigationNode } from "@/types";

function findInTree(nodes: NavigationNode[], id: string): NavigationNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findInTree(n.children, id);
    if (found) return found;
  }
  return null;
}

/** Ancestor chain from a root down to (and including) the target node. */
function findPath(tree: NavigationNode[], targetId: string): NavigationNode[] {
  for (const n of tree) {
    if (n.id === targetId) return [n];
    const found = findPath(n.children, targetId);
    if (found.length > 0) return [n, ...found];
  }
  return [];
}

function slugPathMap(tree: NavigationNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: NavigationNode[], prefix: string[]) => {
    for (const n of nodes) {
      const path = [...prefix, n.slug];
      map.set(n.id, path.join("/"));
      walk(n.children, path);
    }
  };
  walk(tree, []);
  return map;
}

/** All documents in tree display order — used for Previous/Next navigation. */
function flattenDocuments(nodes: NavigationNode[], out: NavigationNode[] = []): NavigationNode[] {
  for (const n of nodes) {
    if (n.type === "DOCUMENT" && n.documentId) out.push(n);
    flattenDocuments(n.children, out);
  }
  return out;
}

export const dynamic = "force-dynamic";

export default async function DocumentationView({ params }: { params: Promise<{ slug: string[] }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role };
  const slugs = (await params).slug;

  const node = await findBySlugPath(actor, slugs);
  if (!node) notFound();

  if (node.type === "LINK" && node.linkUrl) redirect(node.linkUrl);
  if (node.type === "FOLDER") {
    const tree = await getTree(actor);
    const folderNode = findInTree(tree, node.id);
    const children = folderNode?.children ?? [];
    return (
      <div className="mx-auto w-full max-w-3xl px-8 py-14">
        <div className="mb-6 flex items-center gap-2">
          <Folder className="size-4 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">{node.title}</h1>
        </div>
        <ul className="space-y-2">
          {children.map((child) => (
            <li key={child.id}>
              <Link
                href={
                  child.type === "DOCUMENT"
                    ? `/documentation/${slugs.join("/")}/${child.slug}`
                    : child.linkUrl ?? "#"
                }
                target={child.type === "LINK" ? "_blank" : undefined}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-accent/50"
              >
                {child.type === "DOCUMENT" ? (
                  <FileText className="size-3.5 text-muted-foreground" />
                ) : (
                  <Link2 className="size-3.5 text-muted-foreground" />
                )}
                <span className="font-medium">{child.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{child.children.length} item(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!node.documentId) notFound();
  const doc = await getDocument(actor, node.documentId);
  const content = doc.content as import("@/types/editor").TiptapDocument;

  // The right-hand "On This Page" panel is generated from the document's
  // current headings — never stored or edited manually, so it always reflects
  // the latest content after an admin saves.
  const tocItems = extractHeadings(content);

  const canEdit = actor.role === "ADMIN" || actor.role === "EDITOR";

  // Breadcrumbs and Previous/Next are derived from the navigation tree.
  const tree = await getTree(actor);
  const paths = slugPathMap(tree);
  const path = findPath(tree, node.id);
  const crumbs = path.slice(0, -1);
  const childPages = path.length > 0 ? path[path.length - 1].children : [];

  const docs = flattenDocuments(tree);
  const idx = docs.findIndex((d) => d.id === node.id);
  const prev = idx > 0 ? docs[idx - 1] : null;
  const next = idx >= 0 && idx < docs.length - 1 ? docs[idx + 1] : null;

  let authorName: string | null = null;
  if (doc.updatedBy) {
    try {
      const u = await getUserById(doc.updatedBy);
      authorName = u.name;
    } catch {
      authorName = null;
    }
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto flex w-full max-w-[1100px] items-start gap-8 px-8 py-10">
        {/* Center column — breadcrumbs, title, metadata, content, prev/next */}
        <div className="min-w-0 max-w-[820px] flex-1">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/documentation" className="flex items-center gap-1 transition-colors hover:text-foreground">
              <Home className="size-3.5" /> Home
            </Link>
            {crumbs.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <ChevronRight className="size-3.5" />
                <Link
                  href={`/documentation/${paths.get(c.id) ?? c.slug}`}
                  className="transition-colors hover:text-foreground"
                >
                  {c.title}
                </Link>
              </span>
            ))}
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">{node.title}</span>
          </nav>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">{doc.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>Last updated: {new Date(doc.updatedAt).toLocaleDateString()}</span>
            {authorName && <span>By {authorName}</span>}
            {canEdit && (
              <Button asChild size="sm" variant="outline" className="ml-auto gap-1.5">
                <Link href={`/editor/${doc.id}`}>
                  <Pencil className="size-3.5" /> Edit
                </Link>
              </Button>
            )}
          </div>

          <div className="mt-8">
            <DocumentViewer variant="reader" content={content} headings={tocItems} />
          </div>

          {/* Child pages — separate documents/folders attached under this one */}
          {childPages.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Child pages</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {childPages.map((child) => {
                  const Icon = child.type === "FOLDER" ? Folder : child.type === "LINK" ? Link2 : FileText;
                  const href =
                    child.type === "LINK" ? child.linkUrl ?? "#" : `/documentation/${paths.get(child.id) ?? child.slug}`;
                  return (
                    <li key={child.id}>
                      <Link
                        href={href}
                        target={child.type === "LINK" ? "_blank" : undefined}
                        className="group flex items-start gap-2.5 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{child.title}</span>
                          {child.description && (
                            <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                              {child.description}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(prev || next) && (
            <div className="mt-12 flex items-stretch justify-between gap-4 border-t pt-6">
              {prev ? (
                <Link
                  href={`/documentation/${paths.get(prev.id) ?? prev.slug}`}
                  className="group flex max-w-[45%] flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeft className="size-3" /> Previous
                  </span>
                  <span className="truncate text-sm font-medium group-hover:text-foreground">{prev.title}</span>
                </Link>
              ) : (
                <span className="flex-1" />
              )}
              {next ? (
                <Link
                  href={`/documentation/${paths.get(next.id) ?? next.slug}`}
                  className="group ml-auto flex max-w-[45%] flex-col items-end gap-1 rounded-lg border p-4 text-right transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    Next <ArrowRight className="size-3" />
                  </span>
                  <span className="truncate text-sm font-medium group-hover:text-foreground">{next.title}</span>
                </Link>
              ) : (
                <span className="flex-1" />
              )}
            </div>
          )}
        </div>

        {/* Right column — sticky table of contents (desktop only) */}
        {tocItems.length > 0 && (
          <OnThisPage items={tocItems} className="sticky top-0 hidden w-56 shrink-0 lg:block" />
        )}
      </div>
    </div>
  );
}
