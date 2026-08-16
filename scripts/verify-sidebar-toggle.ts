import { chromium } from "playwright-core";
import "dotenv/config";
import { createSessionToken } from "../src/lib/auth/session";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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

  const asideBox = () =>
    page.$eval("aside", (el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width) };
    });
  const isVisible = async (label: string) => {
    const el = await page.$(`[aria-label="${label}"]`);
    return el ? await el.isVisible() : false;
  };

  // --- Desktop: expand -> fully collapse -> restore ---
  await page.goto(`${BASE}/documentation`, { waitUntil: "networkidle" });
  await page.waitForSelector('[aria-label="Hide sidebar"]', { timeout: 10000 });
  console.log("desktop expanded:", JSON.stringify(await asideBox()), "| close btn:", await isVisible("Hide sidebar"), "| open btn:", await isVisible("Show sidebar"));

  await page.click('[aria-label="Hide sidebar"]');
  await page.waitForTimeout(400);
  console.log("desktop collapsed:", JSON.stringify(await asideBox()), "| close btn:", await isVisible("Hide sidebar"), "| open btn:", await isVisible("Show sidebar"));
  await page.screenshot({ path: "/tmp/sidebar-collapsed.png" });

  await page.click('[aria-label="Show sidebar"]');
  await page.waitForTimeout(400);
  console.log("desktop restored:", JSON.stringify(await asideBox()));
  await page.screenshot({ path: "/tmp/sidebar-desktop.png" });

  // --- Mobile: open button -> drawer -> backdrop close -> Escape close ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  console.log("mobile closed:", JSON.stringify(await asideBox()), "| close btn:", await isVisible("Hide sidebar"), "| open btn:", await isVisible("Show sidebar"));

  await page.click('[aria-label="Show sidebar"]', { force: true });
  await page.waitForTimeout(400);
  console.log("mobile drawer open:", JSON.stringify(await asideBox()), "| close btn:", await isVisible("Hide sidebar"));
  await page.screenshot({ path: "/tmp/sidebar-mobile-open.png" });

  await page.mouse.click(360, 400); // outside the 288px drawer
  await page.waitForTimeout(400);
  console.log("mobile after backdrop:", JSON.stringify(await asideBox()));

  await page.click('[aria-label="Show sidebar"]', { force: true });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  console.log("mobile after Escape:", JSON.stringify(await asideBox()));

  console.log(errors.length === 0 ? "PASS: no console errors" : "console errors:\n" + errors.join("\n"));
  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
