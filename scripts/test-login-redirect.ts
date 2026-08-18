/**
 * Tests for the login redirect logic — src/lib/auth/redirect.ts and the
 * `next` construction used by src/proxy.ts.
 * Run: npm run test:redirect
 */
import { DEFAULT_AUTH_DESTINATION, safeNextPath } from "../src/lib/auth/redirect";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

// ---- safeNextPath: valid internal destinations are accepted ----
{
  check(safeNextPath("/editor/ABC") === "/editor/ABC", "accepts /editor/ABC");
  check(safeNextPath("/documentation") === "/documentation", "accepts /documentation");
  check(safeNextPath("/editor/ABC?tab=1") === "/editor/ABC?tab=1", "accepts /editor/ABC?tab=1 (query preserved)");
  check(safeNextPath("/documentation/architecture/frontend") === "/documentation/architecture/frontend", "accepts nested doc path");
  check(safeNextPath("/") === "/", "accepts root /");
  check(safeNextPath("/login?next=%2Feditor%2FABC") === "/login?next=%2Feditor%2FABC", "accepts next containing an encoded next");
  check(safeNextPath(" /editor/ABC") === "/editor/ABC", "trims surrounding whitespace");
}

// ---- safeNextPath: invalid / external destinations are rejected ----
{
  check(safeNextPath(null) === null, "rejects null");
  check(safeNextPath(undefined) === null, "rejects undefined");
  check(safeNextPath("") === null, "rejects empty string");
  check(safeNextPath("   ") === null, "rejects whitespace-only");
  check(safeNextPath("https://malicious-site.com") === null, "rejects https:// external URL");
  check(safeNextPath("http://malicious-site.com") === null, "rejects http:// external URL");
  check(safeNextPath("//malicious-site.com") === null, "rejects protocol-relative // URL");
  check(safeNextPath("///malicious-site.com") === null, "rejects triple-slash URL");
  check(safeNextPath("javascript:alert(1)") === null, "rejects javascript: URL");
  check(safeNextPath("  javascript:alert(1)") === null, "rejects javascript: URL after trim");
  check(safeNextPath("/\\malicious-site.com") === null, "rejects backslash-normalized // URL");
  check(safeNextPath("\\malicious-site.com") === null, "rejects leading backslash");
  check(safeNextPath("/editor/ABC\\def") === null, "rejects embedded backslash");
  check(safeNextPath("/editor/ABC\u0000") === null, "rejects control characters");
  check(safeNextPath("/editor/ABC\u0007") === null, "rejects bell character");
}

// ---- default destination behavior (mirrors the login page) ----
{
  check((safeNextPath(null) ?? DEFAULT_AUTH_DESTINATION) === "/documentation", "missing next falls back to /documentation");
  check((safeNextPath("https://evil.com") ?? DEFAULT_AUTH_DESTINATION) === "/documentation", "invalid external next falls back to /documentation");
  check((safeNextPath("//evil.com") ?? DEFAULT_AUTH_DESTINATION) === "/documentation", "protocol-relative next falls back to /documentation");
}

// ---- proxy `next` construction: derived from current request, URL-encoded ----
{
  // Mirrors src/proxy.ts: next = pathname + req.nextUrl.search, set via URLSearchParams.
  const buildNext = (pathname: string, search: string) => pathname + search;

  const next1 = buildNext("/editor/ABC", "");
  const url1 = new URL("http://localhost:3000/login");
  url1.searchParams.set("next", next1);
  check(url1.searchParams.get("next") === "/editor/ABC", "next for /editor/ABC derives from the current request");

  // A different request produces a different next — never a stale one.
  const next2 = buildNext("/editor/ANOTHER", "");
  const url2 = new URL("http://localhost:3000/login");
  url2.searchParams.set("next", next2);
  check(url2.searchParams.get("next") === "/editor/ANOTHER", "next for /editor/ANOTHER derives from the current request");
  check(url2.searchParams.get("next") !== url1.searchParams.get("next"), "/editor/ANOTHER never reuses /editor/ABC's next");

  // Query parameters of the original request are preserved inside next and
  // properly URL-encoded on the wire.
  const next3 = buildNext("/editor/ABC", "?tab=1&q=hello world");
  const url3 = new URL("http://localhost:3000/login");
  url3.searchParams.set("next", next3);
  const raw = url3.searchParams.toString();
  check(raw.includes("next=%2Feditor%2FABC%3Ftab%3D1%26q%3Dhello%20world") || url3.searchParams.get("next") === "/editor/ABC?tab=1&q=hello world", "query params preserved and URL-encoded in next");

  // safeNextPath accepts what the proxy generates (round trip).
  check(safeNextPath(url3.searchParams.get("next")) === "/editor/ABC?tab=1&q=hello world", "proxy-generated next round-trips through safeNextPath");
}

if (failures === 0) {
  console.log("All login-redirect tests passed.");
} else {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
