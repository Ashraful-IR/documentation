import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./token";

export { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "./token";

/** Reads and verifies the session cookie (server components / route handlers). */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token)?.uid ?? null;
}
