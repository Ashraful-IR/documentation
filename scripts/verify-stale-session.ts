import "dotenv/config";
import { createSessionToken } from "../src/lib/auth/session";

// A validly-signed session for a user that does not exist (simulates a stale
// cookie from before a DB reset/re-seed).
const stale = createSessionToken("00000000-0000-0000-0000-000000000000");

const base = process.env.BASE_URL ?? "http://localhost:3001";

async function check(path: string, cookie: string | null) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { Cookie: `doc_session=${cookie}` } : {},
    redirect: "manual",
  });
  console.log(
    `${path.padEnd(20)} cookie=${cookie ? "yes" : "no "} -> ${res.status} ${res.headers.get("location") ?? ""}`,
  );
}

async function main() {
  // Protected page with a stale session: must redirect to /login, not 500.
  await check("/documentation", stale);
  // Login page with a stale session: must render (200), not bounce to /documentation.
  await check("/login", stale);
  // Login page with no session: renders normally.
  await check("/login", null);
  // Protected page with no session: redirects to /login.
  await check("/documentation", null);
  // Happy path: valid session for the seeded admin resolves normally.
  const valid = createSessionToken("9376024e-3c6a-4bf2-bc0e-7c237704d94e");
  await check("/documentation", valid);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
