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
});
