import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { publishDocumentSchema } from "@/schemas/document.schema";
import * as docs from "@/services/document.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const input = publishDocumentSchema.parse(await req.json());
    return ok(await docs.publishDocument(actor, id, input));
  } catch (err) {
    return handleError(err);
  }
}
