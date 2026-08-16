import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { moveNavigationSchema } from "@/schemas/navigation.schema";
import * as nav from "@/services/navigation.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const input = moveNavigationSchema.parse(await req.json());
    return ok(await nav.moveNode(actor, id, input));
  } catch (err) {
    return handleError(err);
  }
}
