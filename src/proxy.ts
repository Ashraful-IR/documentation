import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "./lib/auth/token";

const AUTH_PATHS = ["/login", "/register"];

// Comma-separated allowed origins, e.g. "http://localhost:3001,https://docs.example.com".
// "*" allows any origin but disables credentials. Empty => CORS disabled (same-origin only).
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CORS_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization";
const CORS_MAX_AGE = "86400";

/** Returns the origin to echo in Access-Control-Allow-Origin, or null when the request origin isn't allowed. */
function corsOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (CORS_ALLOWED_ORIGINS.includes("*")) return "*";
  return CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = corsOrigin(origin);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_HEADERS,
    "Access-Control-Max-Age": CORS_MAX_AGE,
    Vary: "Origin",
    // Cookie-based sessions — only set when echoing a specific origin, never with "*".
    ...(allowed !== "*" ? { "Access-Control-Allow-Credentials": "true" } : {}),
  };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");

  // CORS preflight — answer before any auth redirect logic.
  if (req.method === "OPTIONS") {
    const allowed = corsOrigin(origin);
    if (allowed) {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }
    return NextResponse.next();
  }

  const res = NextResponse.next();
  // Cross-origin access applies to the JSON API only; pages stay same-origin.
  if (pathname.startsWith("/api")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
  }

  // Authenticated = the session cookie carries a token that verifies (signature
  // + expiry). A present-but-stale cookie (expired / re-signed) must not count
  // as authenticated, otherwise the destination would be lost — the request
  // would fall through to the page's bare `redirect("/login")` without `next`.
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = verifySessionToken(sessionToken) !== null;
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname.startsWith("/api/auth");

  if (!hasSession && !isAuthPage && !isAuthApi && pathname !== "/") {
    // Derive `next` from the CURRENT request — pathname + query string — so
    // the post-login redirect returns exactly where this request was headed.
    // searchParams.set() URL-encodes the value, so the destination survives
    // the round trip intact (including its own query parameters).
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Note: no "session present ⇒ skip auth pages" redirect here. That check
  // happens in the (auth) layout, where the session is verified against the
  // DB — a stale cookie (user deleted / DB reset) must be able to reach the
  // login form instead of looping.
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
