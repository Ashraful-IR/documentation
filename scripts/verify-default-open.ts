import { chromium } from "playwright-core";
import "dotenv/config";
import { createSessionToken } from "../src/lib/auth/session";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const BRAVE = "/opt/brave.com/brave/brave";

async function main() {
  const token = createSessionToken("9376024e-3c6a-4bf2-bc0e-7c237704d94e");
  const browser = await chromium.launch({
    executablePath: BRAVE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([{ name: "doc_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const asideWidth = () => page.$eval("aside", (el) => Math.round(el.getBoundingClientRect().width));

  // Simulate the stale persisted "collapsed" flag from before this change.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("documentation:ui:sidebar-collapsed", "true"));
  await page.goto(`${BASE}/documentation`, { waitUntil: "networkidle" });
  await page.waitForSelector("aside", { timeout: 10000 });
  await page.waitForTimeout(500);
  console.log("load with stale collapsed flag -> sidebar width:", await asideWidth());

  // Collapse during the session, then reload: must come back open.
  await page.click('[aria-label="Hide sidebar"]');
  await page.waitForTimeout(400);
  console.log("after manual collapse -> sidebar width:", await asideWidth());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("aside", { timeout: 10000 });
  await page.waitForTimeout(500);
  console.log("after reload -> sidebar width:", await asideWidth());

  console.log(errors.length === 0 ? "PASS: no console errors" : "console errors:\n" + errors.join("\n"));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
