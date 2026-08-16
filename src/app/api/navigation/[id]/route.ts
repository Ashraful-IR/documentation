import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { updateNavigationSchema } from "@/schemas/navigation.schema";
import * as nav from "@/services/navigation.service";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const input = updateNavigationSchema.parse(await req.json());
    return ok(await nav.updateNode(actor, id, input));
  } catch (err) {
    return handleError(err);
  }
}

/** Soft delete by default; `?permanent=true` for the explicit trash-empty path. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const permanent = new URL(req.url).searchParams.get("permanent") === "true";
    if (permanent) {
      await nav.hardDeleteNode(actor, id);
      return ok({ deleted: true, permanent: true });
    }
    const result = await nav.softDeleteNode(actor, id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
