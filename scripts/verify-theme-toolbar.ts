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
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));

  const setTheme = async (t: string) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.evaluate((v) => localStorage.setItem("theme", v), t);
  };

  type Measured = {
    toolbarBg: string | null;
    toolbarBorder: string | null;
    workspaceBg: string | null;
    pageBg: string | null;
    htmlDark: boolean | null;
    leftGap: number | null;
    rightGap: number | null;
  };

  const measure = async (): Promise<Measured> =>
    (await page.evaluate(`(() => {
      const bar = document.querySelector('[aria-label="Zoom in"]')?.closest('div[class*="border-b"]');
      const paper = document.querySelector('div.shadow-2xl.bg-white');
      const firstBtn = document.querySelector('[aria-label="Zoom out"]');
      const lastBtn = [...document.querySelectorAll('div[class*="border-b"] button')].pop();
      const r = (el) => (el ? el.getBoundingClientRect() : null);
      const barR = r(bar), firstR = r(firstBtn), lastR = r(lastBtn);
      return {
        toolbarBg: bar ? getComputedStyle(bar).backgroundColor : null,
        toolbarBorder: bar ? getComputedStyle(bar).borderBottomColor : null,
        workspaceBg: getComputedStyle(document.querySelector('div.overflow-auto')).backgroundColor,
        pageBg: paper ? getComputedStyle(paper).backgroundColor : null,
        htmlDark: document.documentElement.classList.contains("dark"),
        leftGap: firstR && barR ? Math.round(firstR.left - barR.left) : null,
        rightGap: lastR && barR ? Math.round(barR.right - lastR.right) : null,
      };
    })()`) as Measured);

  // --- Light mode ---
  await setTheme("light");
  await page.goto(`${BASE}/documentation/overview`, { waitUntil: "networkidle" });
  const editorHref = await page.$eval('a[href^="/editor/"]', (a) => a.getAttribute("href")).catch(() => null);
  await page.goto(`${BASE}${editorHref}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".document-body", { timeout: 15000 });
  await page.waitForTimeout(500);
  const light = await measure();
  console.log("LIGHT:", JSON.stringify(light));
  await page.screenshot({ path: "/tmp/editor-light.png", fullPage: true });

  // --- Dark mode ---
  await setTheme("dark");
  await page.goto(`${BASE}${editorHref}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".document-body", { timeout: 15000 });
  await page.waitForTimeout(500);
  const dark = await measure();
  console.log("DARK: ", JSON.stringify(dark));
  await page.screenshot({ path: "/tmp/editor-dark.png", fullPage: true });

  // Both themes share the brand palette (navy workspace, GP-green accents) by
  // design — so light and dark must render identically, the paper stays white
  // in both, and the toolbar stays centered with no console errors.
  const ok =
    light.workspaceBg === dark.workspaceBg &&
    light.toolbarBg === dark.toolbarBg &&
    light.pageBg === "rgb(255, 255, 255)" &&
    dark.pageBg === "rgb(255, 255, 255)" &&
    light.leftGap !== null && light.rightGap !== null &&
    Math.abs((light.leftGap ?? 0) - (light.rightGap ?? 0)) <= 60 &&
    errors.length === 0;
  console.log(ok ? "PASS: brand palette in both themes, white paper, centered toolbar" : "FAIL");
  console.log(errors.length === 0 ? "PASS: no console errors" : "errors:\n" + errors.slice(0, 6).join("\n"));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
