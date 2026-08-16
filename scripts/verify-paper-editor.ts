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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "doc_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text().slice(0, 160)}`));
  page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 160)}`));

  await page.goto(`${BASE}/documentation/overview`, { waitUntil: "networkidle" });
  const editorHref = await page.$eval('a[href^="/editor/"]', (a) => a.getAttribute("href")).catch(() => null);

  // --- Editor ---
  await page.goto(`${BASE}${editorHref}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".document-body", { timeout: 15000 });
  await page.waitForTimeout(800);

  const layout = await page.evaluate(`(() => {
    const paper = document.querySelector('div.shadow-2xl.bg-white');
    const body = document.querySelector('.document-body');
    const workspace = paper?.closest('div.overflow-auto');
    const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    return {
      paper: r(paper),
      body: r(body),
      workspaceBg: workspace ? getComputedStyle(workspace).backgroundColor : null,
      toolbarBg: getComputedStyle(document.querySelector('[aria-label="Zoom in"]')?.closest('div[class*="border-b"]') ?? document.body).backgroundColor,
      titleInPage: !!document.querySelector('input[aria-label="Document title"]'),
      pageHeaderLabel: !!document.querySelector('div.shadow-2xl.bg-white span'),
    };
  })()`);
  console.log("editor layout:", JSON.stringify(layout));
  await page.screenshot({ path: "/tmp/paper-editor.png", fullPage: true });

  // Zoom
  await page.click('[aria-label="Zoom in"]');
  await page.waitForTimeout(300);
  const zoomAfter = await page.evaluate(`(() => { const el = [...document.querySelectorAll('span')].find((s) => /^\\d+%$/.test(s.textContent ?? '')); return el ? el.textContent : null; })()`);
  console.log("zoom after +:", zoomAfter);

  // Formatting: make first block H1, then check inline formatting via selection
  await page.click('button[aria-label="Block style"]');
  await page.click('text=Heading 1');
  await page.waitForTimeout(300);
  const h1 = await page.locator(".document-body h1").count();
  console.log("h1 count:", h1);

  // Viewer
  await page.goto(`${BASE}/documentation/overview`, { waitUntil: "networkidle" });
  await page.waitForSelector(".document-body", { timeout: 15000 });
  await page.waitForTimeout(600);
  const viewer = await page.evaluate(`(() => {
    const paper = document.querySelector('article.shadow-2xl.bg-white');
    return { paper: !!paper, w: paper ? Math.round(paper.getBoundingClientRect().width) : 0, titleInPaper: !!paper?.querySelector('h1') };
  })()`);
  console.log("viewer:", JSON.stringify(viewer));
  await page.screenshot({ path: "/tmp/paper-viewer.png", fullPage: true });

  const realErrors = errors.filter((e) => !e.includes("Failed to load resource"));
  console.log(realErrors.length === 0 ? "PASS: no console errors" : "console errors:\n" + realErrors.slice(0, 8).join("\n"));
  await browser.close();
  process.exit(realErrors.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
