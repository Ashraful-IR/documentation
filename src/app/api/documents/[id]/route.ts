import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { updateDocumentSchema } from "@/schemas/document.schema";
import * as docs from "@/services/document.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    return ok(await docs.getDocument(actor, id));
  } catch (err) {
    return handleError(err);
  }
}

/** Autosave path — content only, never creates a version row (§13). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const input = updateDocumentSchema.parse(await req.json());
    return ok(await docs.updateDocumentContent(actor, id, input));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    await docs.softDeleteDocument(actor, id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
