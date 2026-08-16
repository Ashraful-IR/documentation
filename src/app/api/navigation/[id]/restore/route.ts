import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as nav from "@/services/navigation.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    await nav.restoreNode(actor, id);
    return ok({ restored: true });
  } catch (err) {
    return handleError(err);
  }
}
