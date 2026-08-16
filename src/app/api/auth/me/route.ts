import { ok, handleError } from "@/lib/http";
import { getActorOrNull } from "@/lib/auth/actor";
import { getUserById } from "@/services/user.service";

export async function GET() {
  try {
    const actor = await getActorOrNull();
    if (!actor) return ok(null);
    const user = await getUserById(actor.id);
    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    return handleError(err);
  }
}
