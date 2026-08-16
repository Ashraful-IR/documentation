import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const BRAVE = "/opt/brave.com/brave/brave";

async function main() {
  const browser = await chromium.launch({
    executablePath: BRAVE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.waitForTimeout(1000);

  const scriptTagWarnings = errors.filter((e) => e.includes("Encountered a script tag"));
  console.log(scriptTagWarnings.length === 0 ? "PASS: no script-tag warning" : `FAIL: ${scriptTagWarnings.length} warning(s)`);
  const other = errors.filter((e) => !e.includes("Encountered a script tag"));
  if (other.length > 0) console.log("other console errors:\n" + other.join("\n"));
  else console.log("PASS: no other console errors");

  await browser.close();
  process.exit(scriptTagWarnings.length === 0 && other.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
