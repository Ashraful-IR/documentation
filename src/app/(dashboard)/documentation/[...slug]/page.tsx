import { FileText, Folder, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { getSessionUser } from "@/lib/auth/actor";
import { findBySlugPath, getTree } from "@/services/navigation.service";
import { getDocument } from "@/services/document.service";

function findInTree(nodes: import("@/types").NavigationNode[], id: string): import("@/types").NavigationNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findInTree(n.children, id);
    if (found) return found;
  }
  return null;
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

  const canEdit = actor.role === "ADMIN" || actor.role === "EDITOR";

  return (
    <div className="min-h-full">
      {/* App-level metadata strip — the title itself renders on the paper page */}
      <div className="mx-auto flex w-full max-w-[820px] items-center justify-between gap-3 px-8 py-4">
        <div className="flex items-center gap-2">
          <Badge variant={doc.status === "PUBLISHED" ? "default" : "secondary"} className="text-[10px]">
            {doc.status}
          </Badge>
          {doc.publishedAt && (
            <span className="text-xs text-muted-foreground">Published {new Date(doc.publishedAt).toLocaleDateString()}</span>
          )}
          <span className="text-xs text-muted-foreground">Updated {new Date(doc.updatedAt).toLocaleString()}</span>
        </div>
        {canEdit && (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/editor/${doc.id}`}>
              <Pencil className="size-3.5" /> Edit
            </Link>
          </Button>
        )}
      </div>
      <DocumentViewer content={doc.content as import("@/types/editor").TiptapDocument} title={doc.title} />
    </div>
  );
}
