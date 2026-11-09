// V2 footage capture: real local build, 1920x1080, mock transport.
// NEVER prints secrets: the AG key is read from APIS.txt into env only.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const ROOT = "Z:/Hackatons/Paypal";
const OUT = join(ROOT, "brag-output/paypal-ai-2026/composition/assets/raw-v2");
mkdirSync(OUT, { recursive: true });

// Parse AG key without ever logging it: line "AG_STUDIO_LICENSE_KEY=<v>" or value on next line.
const apis = readFileSync(join(ROOT, "APIS.txt"), "utf8").split(/\r?\n/);
let studioKey = "";
for (let i = 0; i < apis.length; i++) {
  const m = /^AG_STUDIO_LICENSE_KEY=(.*)$/.exec(apis[i].trim());
  if (m) { studioKey = m[1].trim(); break; }
  if (apis[i].trim() === "AG_STUDIO_LICENSE_KEY") {
    for (let j = i + 1; j < apis.length; j++) {
      if (apis[j].trim() !== "") { studioKey = apis[j].trim(); break; }
    }
    break;
  }
}
if (studioKey === "") throw new Error("AG key not found in APIS.txt (names only, value never logged)");

const server = spawn("node", ["apps/api/dist/apps/api/src/index.js"], {
  cwd: ROOT,
  env: {
    ...process.env, PORT: "3222", AFTERPACT_DATA_DIR: join(OUT, "..", "..", "v2-data"),
    AG_STUDIO_LICENSE_KEY: studioKey, PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "",
    VULTR_INFERENCE_API_KEY: "", CHANNEL3_API_KEY: "",
  },
  stdio: "pipe", shell: false,
});
studioKey = "";
const waitUp = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3222/api/health");
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server did not come up");
};

const run = async () => {
  await waitUp();
  const browser = await chromium.launch();
  const rec = async (name, fn) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark", recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } });
    const page = await ctx.newPage();
    await fn(page);
    await ctx.close();
    console.log(`captured ${name}`);
  };
  // f8: landing funnel hold.
  await rec("f8-landing", async (page) => {
    await page.goto("http://127.0.0.1:3222/#/");
    await page.waitForSelector("[data-landing-tour-link]", { timeout: 15000 });
    await page.waitForTimeout(6000);
  });
  // clip6: judge tour, full play.
  await rec("clip6-tour", async (page) => {
    await page.goto("http://127.0.0.1:3222/#/judge");
    await page.waitForSelector("#judgeTour", { timeout: 15000 });
    await page.locator("[data-tour-panel]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await page.locator("#judgeTour").click();
    await page.waitForSelector("[data-tour-finale]", { timeout: 60000 });
    await page.locator("[data-tour-finale]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(4500);
  });
  // f7: licensed studio + risk tools.
  await rec("f7-studio", async (page) => {
    await page.goto("http://127.0.0.1:3222/#/studio");
    await page.getByText("LICENSED", { exact: false }).first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(9000);
  });
  await browser.close();
};

try {
  await run();
  console.log("CAPTURE_OK");
} finally {
  server.kill();
  await new Promise((r) => setTimeout(r, 1500));
  try { process.kill(server.pid, "SIGKILL"); } catch { /* already dead */ }
}
