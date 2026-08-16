import { ok, handleError } from "@/lib/http";
import { requireActor } from "@/lib/auth/actor";
import * as userService from "@/services/user.service";

export async function GET() {
  try {
    const actor = await requireActor();
    return ok(await userService.listUsers(actor));
  } catch (err) {
    return handleError(err);
  }
}
