import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import { z } from "zod";
import { updateProfile } from "@/services/user.service";

const profileSchema = z.object({ name: z.string().min(1).max(100).optional() });

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireActor();
    const input = profileSchema.parse(await req.json());
    return ok(await updateProfile(actor.id, input));
  } catch (err) {
    return handleError(err);
  }
}
