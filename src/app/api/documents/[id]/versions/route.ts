import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as docs from "@/services/document.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    return ok(await docs.listVersions(actor, id));
  } catch (err) {
    return handleError(err);
  }
}
