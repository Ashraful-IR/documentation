import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "doc_session";

/**
 * Session lifetime: 12 hours.
 * Single source of truth — used for both the token's `exp` claim and the
 * cookie `maxAge`, so the two can never drift apart.
 */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  uid: string;
  exp: number; // unix seconds
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/**
 * Creates a signed session token: base64url(payload).base64url(hmac).
 * Stateless — the server only needs AUTH_SECRET to verify (§26 keeps the
 * six-table core intact; no sessions table).
 *
 * Pure module (no `next/headers` import) so it can also run in the proxy,
 * which redirects unauthenticated requests before they reach the app.
 */
export function createSessionToken(userId: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SessionPayload = { uid: userId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = sign(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
