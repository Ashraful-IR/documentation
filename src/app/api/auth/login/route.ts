import { NextRequest } from "next/server";

import { ok, handleError } from "@/lib/http";
import { loginSchema } from "@/schemas/user.schema";
import { login } from "@/services/user.service";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const input = loginSchema.parse(await req.json());
    const { user, token } = await login(input);
    const res = ok({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
