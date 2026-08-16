import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { registerSchema } from "@/schemas/user.schema";
import { register } from "@/services/user.service";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const input = registerSchema.parse(await req.json());
    const { user, token } = await register(input);
    const res = ok({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
