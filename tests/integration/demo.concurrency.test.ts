import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

/**
 * Concurrency evidence: 25 simultaneous flagship runs must all complete
 * with unique ids and a valid audit chain, with no cross-run interference.
 *
 * Honest scope: this proves concurrent correctness, NOT session privacy.
 * Demo runs share the global list/audit views (see
 * docs/security/SESSION_ISOLATION_REPORT.md); per-run reset tokens stop
 * cross-run resets, not cross-visitor reads. Do not cite this test as
 * tenant isolation.
 */

function mockEnv(extra: Record<string, string> = {}): Record<string, string | undefined> {
  return {
    ...process.env,
    PAYPAL_CLIENT_ID: "",
    PAYPAL_CLIENT_SECRET: "",
    PAYPAL_MODE: "sandbox",
    CHANNEL3_API_KEY: "",
    VULTR_INFERENCE_API_KEY: "",
    LOG_LEVEL: "silent",
    AFTERPACT_ALLOW_DEMO_RESET: "1",
    ...extra,
  };
}

describe("demo concurrency: 25 simultaneous flagship runs", () => {
  let app: App;
  let base = "";

  beforeAll(async () => {
    app = createApp({ dataDir: ":memory:", webDir: null, processEnv: mockEnv() });
    const port = await app.listen(0);
    base = `http://localhost:${port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("completes every run with a unique id and a valid chain", async () => {
    const startedAt = Date.now();
    const responses = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        fetch(`${base}/api/demo/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenario: "flagship", label: `burst-${i}` }),
        }).then(async (res) => ({ status: res.status, json: (await res.json()) as any })),
      ),
    );
    const wallMs = Date.now() - startedAt;

    for (const [index, r] of responses.entries()) {
      expect(r.status, `burst run ${index} rejected`).toBe(201);
      expect(r.json.data.status, `burst run ${index} not completed`).toBe("completed");
      expect(r.json.data.resetToken).toMatch(/^[0-9a-f]{64}$/);
    }
    const ids = new Set(responses.map((r) => r.json.data.id as string));
    expect(ids.size, "run ids must be unique across the burst").toBe(25);

    // Every run recorded the full 9-act flagship lifecycle.
    for (const r of responses) {
      expect((r.json.data.acts as unknown[]).length).toBe(9);
    }

    // Audit chain still verifies end to end after the burst.
    const auditRes = await fetch(`${base}/api/audit?limit=1`);
    expect(auditRes.status).toBe(200);
    const audit = ((await auditRes.json()) as any).data as { chainValid: boolean; total: number };
    expect(audit.chainValid).toBe(true);
    expect(audit.total).toBeGreaterThan(0);

    // Wall-clock is informational only (machine timing, not a user result).
    expect(wallMs).toBeGreaterThanOrEqual(0);
  }, 60000);
});
