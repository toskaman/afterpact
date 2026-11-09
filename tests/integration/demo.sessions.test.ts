import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

type DemoRunResponse = {
  id: string;
  status: string;
  context: Record<string, string>;
  resetToken?: string;
};

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

async function startApp(envExtra: Record<string, string> = {}): Promise<{ app: App; base: string }> {
  const app = createApp({ dataDir: ":memory:", webDir: null, processEnv: mockEnv(envExtra) });
  const port = await app.listen(0);
  return { app, base: `http://localhost:${port}` };
}

async function post(base: string, path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function runDemo(base: string, scenario: "flagship" | "injection"): Promise<DemoRunResponse> {
  const { status, json } = await post(base, "/api/demo/run", { scenario, label: `test-${scenario}` });
  expect(status).toBe(201);
  return json.data as DemoRunResponse;
}

describe("demo sessions: per-run isolation", () => {
  let app: App;
  let base = "";

  beforeAll(async () => {
    ({ app, base } = await startApp());
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("issues a reset token at creation but never lists it", async () => {
    const run = await runDemo(base, "flagship");
    expect(run.resetToken).toMatch(/^[0-9a-f]{64}$/);
    const res = await fetch(`${base}/api/demo/runs`);
    const list = ((await res.json()) as { data: DemoRunResponse[] }).data;
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const entry of list) {
      expect(entry, "run list must not leak reset tokens").not.toHaveProperty("resetToken");
    }
    // Cleanup so later tests start from a known state.
    await post(base, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
  });

  it("resets exactly one run and leaves the other judge's records intact", async () => {
    const a = await runDemo(base, "flagship");
    const b = await runDemo(base, "flagship");
    expect(a.context["promiseId"]).toBeDefined();
    expect(b.context["promiseId"]).toBeDefined();

    const { status, json } = await post(base, `/api/demo/runs/${a.id}/reset`, { token: a.resetToken });
    expect(status).toBe(200);
    const cleared = json.data.cleared as Record<string, number>;
    expect(cleared).toMatchObject({
      intents: 1, offers: 1, promises: 1, outcomes: 1, evidence: 1, incidents: 1,
      proposals: 1, approvals: 1, orders: 1, captures: 1, refunds: 1, demoRuns: 1,
    });
    expect(cleared["idempotency"]).toBeGreaterThanOrEqual(1);

    // Run A's records are gone...
    expect(app.ops.store.promises.has(a.context["promiseId"]!)).toBe(false);
    expect(app.ops.store.incidents.has(a.context["incidentId"]!)).toBe(false);
    expect(app.ops.store.demoRuns.has(a.id)).toBe(false);
    // ...run B's records are untouched and still readable over HTTP.
    expect(app.ops.store.promises.has(b.context["promiseId"]!)).toBe(true);
    const view = await fetch(`${base}/api/promises/${b.context["promiseId"]}`);
    expect(view.status).toBe(200);
    const incident = await fetch(`${base}/api/incidents/${b.context["incidentId"]}`);
    expect(incident.status).toBe(200);
    const order = await fetch(`${base}/api/payments/orders/${b.context["orderId"]}`);
    expect(order.status).toBe(200);

    // Audit chain stays valid; the reset itself is recorded.
    const health = ((await (await fetch(`${base}/api/health`)).json()) as { data: { auditChainValid: boolean } }).data;
    expect(health.auditChainValid).toBe(true);
    const audit = ((await (await fetch(`${base}/api/audit?type=demo.run-reset`)).json()) as { data: { entries: unknown[] } }).data;
    expect(audit.entries.length).toBeGreaterThanOrEqual(1);

    await post(base, `/api/demo/runs/${b.id}/reset`, { token: b.resetToken });
  });

  it("resets an injection run including both phases", async () => {
    const run = await runDemo(base, "injection");
    const { status, json } = await post(base, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
    expect(status).toBe(200);
    expect((json.data.cleared as Record<string, number>)["promises"]).toBe(2);
    expect(app.ops.store.promises.size).toBe(0);
    expect(app.ops.store.intents.size).toBe(0);
  });

  it("rejects wrong or missing tokens and double resets", async () => {
    const run = await runDemo(base, "flagship");
    const wrong = await post(base, `/api/demo/runs/${run.id}/reset`, { token: "0".repeat(64) });
    expect(wrong.status).toBe(401);
    expect(wrong.json.error.code).toBe("demo-token-invalid");
    expect(app.ops.store.demoRuns.has(run.id)).toBe(true);

    const missing = await post(base, `/api/demo/runs/${run.id}/reset`, {});
    expect(missing.status).toBe(422);

    const ok = await post(base, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
    expect(ok.status).toBe(200);
    const again = await post(base, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
    expect(again.status).toBe(404);
    expect(again.json.error.code).toBe("demo-not-found");
  });

  it("keeps concurrent judges isolated under parallel runs and resets", async () => {
    const runs = await Promise.all(Array.from({ length: 6 }, () => runDemo(base, "flagship")));
    expect(new Set(runs.map((r) => r.id)).size).toBe(6);
    const victims = runs.slice(0, 3);
    const survivors = runs.slice(3);
    const resets = await Promise.all(victims.map((r) => post(base, `/api/demo/runs/${r.id}/reset`, { token: r.resetToken })));
    for (const r of resets) expect(r.status).toBe(200);
    expect(app.ops.store.demoRuns.size).toBe(3);
    expect(app.ops.store.promises.size).toBe(3);
    for (const s of survivors) {
      const view = await fetch(`${base}/api/promises/${s.context["promiseId"]}`);
      expect(view.status, `survivor run ${s.id} lost its promise`).toBe(200);
    }
    for (const v of victims) {
      expect(app.ops.store.promises.has(v.context["promiseId"]!)).toBe(false);
    }
    const health = ((await (await fetch(`${base}/api/health`)).json()) as { data: { auditChainValid: boolean } }).data;
    expect(health.auditChainValid).toBe(true);
    await Promise.all(survivors.map((r) => post(base, `/api/demo/runs/${r.id}/reset`, { token: r.resetToken })));
    expect(app.ops.store.demoRuns.size).toBe(0);
  });
});

describe("demo sessions: guards", () => {
  it("refuses per-run reset when resets are disabled", async () => {
    const { app: locked, base: lockedBase } = await startApp({ AFTERPACT_ALLOW_DEMO_RESET: "0" });
    try {
      const run = await runDemo(lockedBase, "flagship");
      const { status, json } = await post(lockedBase, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
      expect(status).toBe(403);
      expect(json.error.code).toBe("reset-refused");
      expect(locked.ops.store.demoRuns.has(run.id)).toBe(true);
    } finally {
      await locked.close();
    }
  });

  it("enforces run capacity and frees slots on reset", async () => {
    const { app: capped, base: cappedBase } = await startApp({ AFTERPACT_MAX_DEMO_RUNS: "2" });
    try {
      const first = await runDemo(cappedBase, "flagship");
      const second = await runDemo(cappedBase, "injection");
      const overflow = await post(cappedBase, "/api/demo/run", { scenario: "flagship", label: "overflow" });
      expect(overflow.status).toBe(429);
      expect(overflow.json.error.code).toBe("demo-capacity");
      const freed = await post(cappedBase, `/api/demo/runs/${first.id}/reset`, { token: first.resetToken });
      expect(freed.status).toBe(200);
      const retry = await runDemo(cappedBase, "flagship");
      expect(retry.id).toBeDefined();
      expect(capped.ops.store.demoRuns.size).toBe(2);
      void second;
    } finally {
      await capped.close();
    }
  });

  it("gates run-continue behind the per-run token", async () => {
    const { app: gated, base: gatedBase } = await startApp();
    try {
      const a = await runDemo(gatedBase, "flagship");
      const b = await runDemo(gatedBase, "flagship");
      // Missing token malformed (422), sibling token unauthorized (401) —
      // both rejected before any state check.
      expect((await post(gatedBase, `/api/demo/runs/${a.id}/continue`, {})).status).toBe(422);
      expect((await post(gatedBase, `/api/demo/runs/${a.id}/continue`, { token: b.resetToken })).status).toBe(401);
      // Own token passes the gate (mock runs complete synchronously, so the
      // state check answers 409 — proving the token check ran first).
      const own = await post(gatedBase, `/api/demo/runs/${a.id}/continue`, { token: a.resetToken });
      expect(own.status).toBe(409);
      expect(own.json.error.code).toBe("demo-state");
    } finally {
      await gated.close();
    }
  });

  it("rejects an invalid capacity configuration", async () => {
    const { app: broken, base: brokenBase } = await startApp({ AFTERPACT_MAX_DEMO_RUNS: "0" });
    try {
      const res = await fetch(`${brokenBase}/api/demo/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: "flagship" }),
      });
      expect(res.status).toBe(500);
      expect(((await res.json()) as any).error.code).toBe("config");
    } finally {
      await broken.close();
    }
  });
});
