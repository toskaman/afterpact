import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

/**
 * Frontend/backend contract: every `health.<field>` read in app.js must
 * exist in the live /api/health payload. Regression test for the header
 * pill that read `health.chainValid` while the API returns
 * `auditChainValid`, rendering a permanent false "CHAIN BROKEN".
 */

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

let app: App;
let base = "";

beforeAll(async () => {
  app = createApp({
    dataDir: ":memory:",
    webDir: WEB_DIR,
    processEnv: {
      ...process.env,
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_MODE: "sandbox",
      LOG_LEVEL: "silent",
    },
  });
  const port = await app.listen(0);
  base = `http://localhost:${port}`;
}, 30000);

afterAll(async () => {
  await app.close();
});

describe("frontend health contract", () => {
  it("every health.<field> read in app.js exists in /api/health", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const health = ((await res.json()) as { data: Record<string, unknown> }).data;
    expect(health["auditChainValid"]).toBe(true);

    const source = readFileSync(join(WEB_DIR, "app.js"), "utf8");
    const reads = new Set<string>();
    for (const match of source.matchAll(/health\.([A-Za-z_$][\w$]*)/g)) {
      const field = match[1];
      if (field !== undefined) reads.add(field);
    }
    expect(reads.size).toBeGreaterThan(0);
    for (const field of reads) {
      expect(Object.hasOwn(health, field), `app.js reads health.${field} but /api/health has no such field`).toBe(true);
    }
  });

  it("exposes the /api/ai/status fields consumed by the AI pill", async () => {
    const res = await fetch(`${base}/api/ai/status`);
    expect(res.status).toBe(200);
    const status = ((await res.json()) as { data: Record<string, unknown> }).data;
    for (const field of ["keyed", "provider", "model"]) {
      expect(Object.hasOwn(status, field), `/api/ai/status lacks ${field}`).toBe(true);
    }
    expect(status["keyed"]).toBe(false);
  });

  it("every AI endpoint fetched by app.js resolves to a live route", async () => {
    for (const path of ["/api/ai/analyze-intent", "/api/ai/analyze-incident", "/api/ai/plan-recovery"]) {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as { error?: { code?: string } };
      expect(res.status, `${path} is not routed`).toBe(422);
      expect(json.error?.code, `${path} is not validated`).toBe("validation-error");
    }
  });
});

describe("frontend AI surface contract", () => {
  it("renders AI pills, interpretation blocks, and incident AI actions", () => {
    const source = readFileSync(join(WEB_DIR, "app.js"), "utf8");
    const html = readFileSync(join(WEB_DIR, "index.html"), "utf8");
    for (const token of [
      'id="aiPill"',
      "ai-live",
      "ai-off",
      "aiInterpretationHtml",
      "aiAnalysisHtml",
      "recoveryProposalHtml",
      "data-ai-analyze",
      "data-ai-propose",
      "/api/ai/status",
      "/api/ai/analyze-intent",
      "/api/ai/analyze-incident",
      "/api/ai/plan-recovery",
    ]) {
      const found = token.startsWith('id="') ? html.includes(token) : source.includes(token);
      expect(found, `frontend missing AI surface token: ${token}`).toBe(true);
    }
  });
});

describe("frontend Outcome Twin contract", () => {
  it("registers the twin route, nav entry, and three-reality view", () => {
    const source = readFileSync(join(WEB_DIR, "app.js"), "utf8");
    const html = readFileSync(join(WEB_DIR, "index.html"), "utf8");
    const css = readFileSync(join(WEB_DIR, "styles.css"), "utf8");
    for (const token of [
      "renderTwin",
      '"/twin"',
      "What was promised",
      "What actually happened",
      "What AFTERPACT recovered",
      "projection from current state",
      "twinAnalyze",
      "twinPropose",
    ]) {
      expect(source.includes(token), `app.js missing twin token: ${token}`).toBe(true);
    }
    expect(html.includes('data-route="twin"'), "nav missing twin entry").toBe(true);
    expect(css.includes(".grid.three"), "styles missing .grid.three").toBe(true);
  });
});
