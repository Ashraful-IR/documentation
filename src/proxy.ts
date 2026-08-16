import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "doc_session";
const AUTH_PATHS = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname.startsWith("/api/auth");

  if (!hasSession && !isAuthPage && !isAuthApi && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Note: no "session present ⇒ skip auth pages" redirect here. That check
  // happens in the (auth) layout, where the session is verified against the
  // DB — a stale cookie (user deleted / DB reset) must be able to reach the
  // login form instead of looping.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
