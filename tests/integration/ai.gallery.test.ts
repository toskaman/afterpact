import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

const REPO_ROOT = join(__dirname, "..", "..");
const WEB_DIR = join(REPO_ROOT, "apps", "web", "public");

/**
 * AI Evidence Gallery: every featured outcome must match its committed
 * eval report verbatim, the RECORDED label must be exact, and nothing
 * may read as live inference.
 */

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

type Gallery = {
  label: string;
  live: boolean;
  notice: string;
  provider: string;
  model: string;
  runs: Array<{
    report: string;
    recordedAt: string;
    scenarios: number;
    passed: number;
    citationPrecision: number;
    costUsd: number;
  }>;
  totals: { runs: number; scenarios: number; passed: number; costUsd: number };
  featured: Array<{
    id: string;
    task: string;
    pass: boolean;
    sourceReport: string;
    [k: string]: unknown;
  }>;
  reproduce: { requires: string; steps: string[]; note: string };
};

function loadGallery(): { raw: string; gallery: Gallery } {
  const path = join(WEB_DIR, "gallery", "ai-gallery.json");
  expect(existsSync(path)).toBe(true);
  const raw = readFileSync(path, "utf8");
  return { raw, gallery: JSON.parse(raw) as Gallery };
}

describe("ai evidence gallery data", () => {
  it("is labeled recorded-never-live", () => {
    const { gallery, raw } = loadGallery();
    expect(gallery.label).toBe("RECORDED VERIFIED AI RUN");
    expect(gallery.live).toBe(false);
    expect(gallery.notice).toMatch(/No inference happens/);
    expect(raw).not.toMatch(/live inference/i);
    expect(raw).not.toMatch(/AI · LIVE/);
    expect(gallery.totals.runs).toBe(gallery.runs.length);
    expect(gallery.featured.length).toBeGreaterThanOrEqual(9);
    // One honest failure must stay in the gallery.
    expect(gallery.featured.some((f) => f.pass === false)).toBe(true);
  });

  it("matches every run against its committed eval report", () => {
    const { gallery } = loadGallery();
    let scenarios = 0;
    let passed = 0;
    for (const run of gallery.runs) {
      const report = JSON.parse(readFileSync(join(REPO_ROOT, run.report), "utf8")) as {
        generatedAt: string;
        model: string;
        totals: { scenarios: number; passed: number };
        live: { citationPrecision: number; costUsd: number };
      };
      expect(run.recordedAt).toBe(report.generatedAt);
      expect(report.model).toBe(gallery.model);
      expect(run.scenarios).toBe(report.totals.scenarios);
      expect(run.passed).toBe(report.totals.passed);
      expect(run.citationPrecision).toBe(report.live.citationPrecision);
      expect(run.costUsd).toBe(report.live.costUsd);
      scenarios += run.scenarios;
      passed += run.passed;
    }
    expect(gallery.totals.scenarios).toBe(scenarios);
    expect(gallery.totals.passed).toBe(passed);
  });

  it("matches every featured outcome against its source report verbatim", () => {
    const { gallery } = loadGallery();
    for (const f of gallery.featured) {
      const report = JSON.parse(readFileSync(join(REPO_ROOT, f.sourceReport), "utf8")) as {
        outcomes: Array<Record<string, unknown>>;
      };
      const outcome = report.outcomes.find((o) => o["id"] === f.id);
      expect(outcome, `featured ${f.id} missing from ${f.sourceReport}`).toBeDefined();
      for (const key of [
        "task",
        "pass",
        "latencyMs",
        "promptTokens",
        "completionTokens",
        "costUsd",
        "attempts",
        "fallbackUsed",
        "origin",
        "modelServed",
        "citationsKept",
        "citationsDropped",
        "gateVerdict",
        "category",
        "strategy",
        "sample",
      ]) {
        expect(f[key], `${f.id}.${key}`).toEqual(outcome![key]);
      }
      const checks = (outcome!["checks"] as Array<{ check: string; pass: boolean }>).map((c) => ({
        check: c.check,
        pass: c.pass,
      }));
      expect(f["checks"]).toEqual(checks);
    }
  });

  it("carries a working reproduce recipe and no secrets", () => {
    const { gallery, raw } = loadGallery();
    expect(gallery.reproduce.requires).toMatch(/VULTR_INFERENCE_API_KEY/);
    expect(gallery.reproduce.steps.join("\n")).toMatch(/AI_EVAL_LIVE=1 npx vitest run tests\/eval\/ai-eval\.live\.test\.ts/);
    expect(gallery.reproduce.steps.join("\n")).toMatch(/build-ai-gallery\.mjs/);
    expect(existsSync(join(REPO_ROOT, "tests", "eval", "ai-eval.live.test.ts"))).toBe(true);
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{8,}|Basic [A-Za-z0-9+/=]{20,}|Bearer [A-Za-z0-9._-]{20,}|client_secret/i);
  });
});

describe("ai evidence gallery wiring", () => {
  it("registers route, nav entry, and recorded badge", () => {
    const source = readFileSync(join(WEB_DIR, "app.js"), "utf8");
    const html = readFileSync(join(WEB_DIR, "index.html"), "utf8");
    for (const token of ["renderAiGallery", '"/ai-gallery"', '"recorded-ai"', "RECORDED VERIFIED AI RUN", "gallery/ai-gallery.json", "NO INFERENCE ON THIS PAGE"]) {
      expect(source.includes(token), `app.js missing gallery token: ${token}`).toBe(true);
    }
    expect(html.includes('data-route="ai-gallery"'), "nav missing ai-gallery entry").toBe(true);
  });

  it("serves the gallery JSON over HTTP", async () => {
    const res = await fetch(`${base}/gallery/ai-gallery.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const gallery = (await res.json()) as Gallery;
    expect(gallery.label).toBe("RECORDED VERIFIED AI RUN");
    expect(gallery.live).toBe(false);
  });
});
