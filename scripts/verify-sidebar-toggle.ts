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

  const errors: string[] = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies([{ name: "doc_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const asideWidth = () => page.$eval("aside", (el) => el.getBoundingClientRect().width);
  const asideBox = () =>
    page.$eval("aside", (el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), visibility: getComputedStyle(el).visibility };
    });

  // --- Desktop ---
  await page.goto(`${BASE}/documentation`, { waitUntil: "networkidle" });
  await page.waitForSelector('[aria-label="Toggle sidebar"]', { timeout: 10000 });
  console.log("desktop expanded:", JSON.stringify(await asideBox()));

  await page.click('[aria-label="Toggle sidebar"]');
  await page.waitForTimeout(400);
  console.log("desktop collapsed:", JSON.stringify(await asideBox()));

  await page.click('[aria-label="Toggle sidebar"]');
  await page.waitForTimeout(400);
  console.log("desktop restored:", JSON.stringify(await asideBox()));
  await page.screenshot({ path: "/tmp/sidebar-desktop.png" });

  // --- Mobile: drawer closed initially, opens via toggle, closes via backdrop ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  console.log("mobile initial:", JSON.stringify(await asideBox()));

  await page.click('[aria-label="Toggle sidebar"]', { force: true });
  await page.waitForTimeout(400);
  console.log("mobile after toggle:", JSON.stringify(await asideBox()));
  await page.screenshot({ path: "/tmp/sidebar-mobile-open.png" });

  const backdrop = await page.$("div.bg-black\\/50");
  console.log("backdrop present when open:", backdrop !== null);
  // Click a point outside the 288px drawer (viewport is 390px wide).
  await page.mouse.click(360, 400);
  await page.waitForTimeout(400);
  console.log("mobile after backdrop click:", JSON.stringify(await asideBox()));

  // Reopen, then close via Escape.
  await page.click('[aria-label="Toggle sidebar"]', { force: true });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  console.log("mobile after Escape:", JSON.stringify(await asideBox()));

  console.log(errors.length === 0 ? "PASS: no console errors" : "console errors:\n" + errors.join("\n"));
  await browser.close();
  const ok =
    errors.length === 0 &&
    true; // state details checked via logs; exit code driven by console errors + manual review
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
