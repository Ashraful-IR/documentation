import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as nav from "@/services/navigation.service";

export async function GET() {
  try {
    const actor = await requireActor();
    return ok(await nav.getTrash(actor));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  try {
    const actor = await requireActor();
    return ok(await nav.emptyTrash(actor));
  } catch (err) {
    return handleError(err);
  }
}
