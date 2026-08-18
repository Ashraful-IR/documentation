/**
 * Login-redirect helpers shared by the proxy (server) and the login page
 * (client). Pure module — no Next-specific imports.
 */

/** Where to send a user after login when no valid `next` destination exists. */
export const DEFAULT_AUTH_DESTINATION = "/documentation";

/**
 * Validates a `next` redirect target so login can only send users to safe
 * internal application paths.
 *
 * Accepts only root-relative paths (e.g. `/editor/abc`, `/documentation`,
 * `/documentation/x?tab=1`). Rejects everything else — external URLs
 * (`https://evil.com`), protocol-relative URLs (`//evil.com`), backslash
 * tricks (`/\evil.com` — browsers normalize `\` to `/`), and control
 * characters. Returns `null` for invalid/missing values so callers can
 * fall back to {@link DEFAULT_AUTH_DESTINATION}.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v.startsWith("/")) return null;
  // Protocol-relative and backslash-normalized variants are treated as
  // external by browsers — reject both before any URL parsing.
  if (v.startsWith("//")) return null;
  if (v.includes("\\")) return null;
  // Control characters never legitimately appear in a URL path.
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  // The WHATWG URL parser normalizes backslash/percent-encoded dot segments,
  // so double-check the value still resolves to this origin.
  try {
    const resolved = new URL(v, "http://internal.invalid");
    if (resolved.origin !== "http://internal.invalid") return null;
  } catch {
    return null;
  }
  return v;
}
