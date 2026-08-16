import { ArrowLeft, Rocket, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { VersionHistory } from "@/components/documents/VersionHistory";
import { getSessionUser } from "@/lib/auth/actor";
import { getDocument, findNavNodeForDocument, publishDocument, checkpointDocument } from "@/services/document.service";
import { getSlugPath } from "@/services/navigation.service";
import { ApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const actor = { id: user.id, role: user.role };

  if (actor.role === "VIEWER") {
    redirect("/documentation");
  }

  const { id } = await params;
  let doc;
  try {
    doc = await getDocument(actor, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const nav = await findNavNodeForDocument(id);
  const backHref = nav ? `/documentation/${await getSlugPath(actor, nav.id)}` : "/documentation";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </Button>
        <div className="flex-1" />
        <VersionHistory documentId={doc.id} currentVersion={doc.currentVersion} />
        <form
          action={async () => {
            "use server";
            await checkpointDocument(actor, doc.id, { changeSummary: null });
          }}
        >
          <Button type="submit" variant="outline" size="sm" className="gap-1.5">
            <Save className="size-3.5" /> Save version
          </Button>
        </form>
        <form
          action={async () => {
            "use server";
            await publishDocument(actor, doc.id, { changeSummary: null });
          }}
        >
          <Button type="submit" size="sm" className="gap-1.5">
            <Rocket className="size-3.5" /> Publish
          </Button>
        </form>
        <Badge variant={doc.status === "PUBLISHED" ? "default" : "secondary"} className="text-[10px]">
          {doc.status}
        </Badge>
      </div>
      <DocumentEditor
        documentId={doc.id}
        initialTitle={doc.title}
        initialContent={doc.content as import("@/types/editor").TiptapDocument}
        serverUpdatedAt={doc.updatedAt}
        canEdit
      />
    </div>
  );
}
