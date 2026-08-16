import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { createDocumentSchema } from "@/schemas/document.schema";
import * as docs from "@/services/document.service";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    const input = createDocumentSchema.parse(await req.json());
    return ok(await docs.createDocument(actor, input), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
