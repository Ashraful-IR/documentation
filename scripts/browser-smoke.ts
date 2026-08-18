/**
 * Headless browser smoke test — drives the real UI with Brave/Chromium.
 * Requires: the app running on :3000 (`npm run build && npm run start`)
 * Run: npm run test:e2e
 */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const BRAVE = "/opt/brave.com/brave/brave";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("  ok:", msg);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: BRAVE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${page.url()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror [${page.url()}]: ${err.message}\n${err.stack ?? ""}`);
  });

  // 1. Route protection: an unauthenticated visit to a protected page is
  // redirected to login with the CURRENT request (path + query) as `next`,
  // and a successful login returns to that exact destination.
  await page.goto(`${BASE}/documentation/overview?tab=1`);
  await page.waitForURL(/\/login\?next=/, { timeout: 10000 });
  const redirectedNext = new URL(page.url()).searchParams.get("next");
  check(
    redirectedNext === "/documentation/overview?tab=1",
    `unauthenticated visit redirected with current path+query as next (got ${redirectedNext})`
  );

  // 2. Login through the real form, with the password show/hide toggle.
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", "admin@local.dev");
  await page.fill("#password", "admin123");
  await page.click("button[aria-label='Show password']");
  check((await page.getAttribute("#password", "type")) === "text", "password visibility toggle shows text");
  await page.click("button[aria-label='Hide password']");
  check((await page.getAttribute("#password", "type")) === "password", "password visibility toggle hides again");
  await page.click("button[type='submit']");
  await page.waitForURL(/\/documentation\/overview\?tab=1$/, { timeout: 10000 });
  check(true, "login returns to the protected page that triggered authentication");

  // 2b. The login URL never carries a stale `next` — visiting a different
  // protected page while logged out re-derives it from that request.
  await context.clearCookies();
  await page.goto(`${BASE}/editor/some-other-doc-id`);
  await page.waitForURL(/\/login\?next=/, { timeout: 10000 });
  check(
    new URL(page.url()).searchParams.get("next") === "/editor/some-other-doc-id",
    "a second protected page re-derives next instead of reusing the first"
  );
  await page.reload();
  check(
    new URL(page.url()).searchParams.get("next") === "/editor/some-other-doc-id",
    "refreshing the login page keeps only the current next"
  );
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", "admin@local.dev");
  await page.fill("#password", "admin123");
  await page.click("button[type='submit']");
  await page.waitForURL(`${BASE}/documentation`, { timeout: 10000 });
  check(true, "login without next uses the default destination");

  // 2. Sidebar renders and toggles.
  await page.waitForSelector("text=Overview", { timeout: 10000 });
  check(await page.locator("text=Architecture").count() > 0, "sidebar tree shows seeded nodes");
  await page.click("button[aria-label='Hide sidebar']");
  await page.waitForTimeout(350);
  const collapsedWidth = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  check(collapsedWidth < 10, "sidebar toggle collapses it");
  await page.click("button[aria-label='Show sidebar']");
  await page.waitForTimeout(350);
  const expandedWidth = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  check(expandedWidth > 250, "sidebar toggle expands it again");

  // 3. View mode renders document content (client-side Tiptap renderer).
  await page.goto(`${BASE}/documentation/overview`);
  await page.waitForSelector("h1:text('Overview')", { timeout: 10000 });
  check(true, "view mode renders document title");
  await page.waitForSelector(".tiptap.ProseMirror", { timeout: 10000 });
  const viewerText = await page.locator(".tiptap.ProseMirror").textContent();
  check((viewerText ?? "").trim().length > 20, "viewer renders stored Tiptap content");
  check(await page.locator("h1").count() >= 1, "rendered H1 exists");

  // 3b. Edit button opens the Tiptap editor interface.
  await page.click("a:has-text('Edit')");
  await page.waitForURL(/\/editor\//, { timeout: 10000 });
  await page.waitForSelector(".tiptap.ProseMirror", { timeout: 10000 });
  check(true, "Edit button opens the Tiptap editor");

  // 4. Editor is interactive and autosaves.
  const docId = page.url().split("/").pop()!;
  const editor = page.locator(".tiptap.ProseMirror");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Browser smoke test paragraph");
  await page.waitForTimeout(2500); // autosave debounce + save
  const saved = await page.evaluate(async (id) => {
    const res = await fetch(`/api/documents/${id}`);
    const body = await res.json();
    return JSON.stringify(body.data.content).includes("Browser smoke test paragraph");
  }, docId);
  check(saved, "autosave persisted typed content");

  // 5. Slash command menu opens (at the start of a fresh paragraph).
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await page.waitForTimeout(400);
  const slashVisible = await page.locator("text=Callout — info").count();
  check(slashVisible > 0, "slash command menu opens");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");

  // 6. Publish from the editor header (server action form).
  await page.waitForSelector("button:has-text('Publish')");
  await page.click("button:has-text('Publish')");
  await page.waitForTimeout(1200);
  const published = await page.evaluate(async (id) => {
    const res = await fetch(`/api/documents/${id}`);
    const body = await res.json();
    return body.data.status === "PUBLISHED";
  }, docId);
  check(published, "publish action works");

  // 6b. The publish confirmation dialog appears — dismiss it.
  await page.waitForSelector("text=Document published", { timeout: 5000 });
  check(true, "publish shows confirmation dialog");
  await page.click("button:has-text('Close')");
  await page.waitForTimeout(300);

  // 7. Version history opens.
  await page.click("button:has-text('History')");
  await page.waitForSelector("text=Version history", { timeout: 5000 });
  check(true, "version history sheet opens");
  await page.keyboard.press("Escape");

  // 8. Search palette.
  await page.click("button:has-text('Search documentation')");
  try {
    await page.waitForSelector("[cmdk-root]", { timeout: 4000, state: "attached" });
    await page.waitForTimeout(300);
    await page.keyboard.type("architecture", { delay: 60 });
    await page.waitForTimeout(1200);
    const results = await page.locator("[cmdk-list] [cmdk-item]").count();
    const listText = await page.locator("[cmdk-list]").textContent().catch(() => "");
    check(results > 0 && (listText ?? "").includes("Architecture"), `search palette shows results (items: ${results})`);
  } catch (err) {
    check(false, `search palette failed: ${(err as Error).message.slice(0, 200)}`);
  }

  // 9. Trash page loads.
  await page.goto(`${BASE}/trash`);
  await page.waitForSelector("text=Trash & hidden", { timeout: 10000 });
  check(true, "trash page renders");

  // 9b. Open-redirect protection: an external `next` is rejected, so login
  // never navigates off-origin.
  {
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/login?next=${encodeURIComponent("https://evil.com")}`);
    await p2.waitForSelector("#email", { timeout: 10000 });
    await p2.fill("#email", "admin@local.dev");
    await p2.fill("#password", "admin123");
    await p2.click("button[type='submit']");
    await p2.waitForURL(`${BASE}/documentation`, { timeout: 10000 });
    check(true, "external next URL is rejected — login lands on the default destination");
    await ctx.close();
  }

  const realErrors = consoleErrors.filter((e) => !e.includes("favicon"));
  check(realErrors.length === 0, `no console errors (${realErrors.length} found)${realErrors.length ? `: ${realErrors.slice(0, 3).join(" | ")}` : ""}`);

  await browser.close();
  if (failures === 0) {
    console.log("\nAll browser smoke tests passed.");
  } else {
    console.error(`\n${failures} failure(s).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
