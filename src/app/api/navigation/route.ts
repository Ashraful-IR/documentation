import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { createNavigationSchema } from "@/schemas/navigation.schema";
import * as nav from "@/services/navigation.service";

export async function GET() {
  try {
    const actor = await requireActor();
    return ok(await nav.getTree(actor));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor();
    const input = createNavigationSchema.parse(await req.json());
    const node = await nav.createNode(actor, input);
    return ok(node, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
