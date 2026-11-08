import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Ops } from "../../apps/api/src/ops";
import { createApp, type App } from "../../apps/api/src/routes";

/**
 * API-driven smoke suite for the frontend backend (no Playwright in this
 * repo, so the UI's entire contract is exercised over HTTP). Covers the
 * copilot flow, payment, incident, resolution, audit export, both demo
 * scenarios, reset gating, and the key negative paths.
 */

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

let app: App;
let base = "";

function url(path: string): string {
  return `${base}${path}`;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as unknown;
  return { status: res.status, json };
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url(path));
  const json = (await res.json()) as unknown;
  return { status: res.status, json };
}

interface Envelope<T = unknown> {
  data: T;
}

interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

function data<T>(json: unknown): T {
  return (json as Envelope<T>).data;
}

function errCode(json: unknown): string {
  return (json as ErrorEnvelope).error.code;
}

async function reset(): Promise<void> {
  const res = await post("/api/demo/reset", {});
  expect(res.status).toBe(200);
}

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

describe("health + static shell", () => {
  it("reports mock transport without credentials", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    const health = data<Record<string, unknown>>(res.json);
    expect(health["status"]).toBe("ok");
    expect(health["transport"]).toBe("mock-simulated");
    expect(health["auditChainValid"]).toBe(true);
    expect(health["resetAllowed"]).toBe(true);
    expect(typeof health["build"]).toBe("string");
  });

  it("exposes the deploy build SHA for version verification", () => {
    const def = new Ops({ dataDir: ":memory:", processEnv: { ...process.env, AFTERPACT_BUILD_SHA: "" } });
    expect(def.health()["build"]).toBe("dev");
    const keyed = new Ops({ dataDir: ":memory:", processEnv: { ...process.env, AFTERPACT_BUILD_SHA: "abc123def456" } });
    expect(keyed.health()["build"]).toBe("abc123def456");
  });

  it("serves the SPA shell and assets", async () => {
    const html = await fetch(url("/")).then((r) => r.text());
    expect(html).toContain("AFTERPACT");
    expect(html).toContain('id="view"');
    const css = await fetch(url("/styles.css")).then((r) => r.text());
    expect(css).toContain("--accent");
    const js = await fetch(url("/app.js")).then((r) => r.text());
    expect(js).toContain("renderCommand");
  });

  it("labels sponsor integrations honestly", async () => {
    const res = await get("/api/config");
    const config = data<Record<string, Record<string, string>>>(res.json);
    // AG Studio canvas + agent run on the /studio view (trial watermark until
    // AG_STUDIO_LICENSE_KEY is set); the Community grid stays below it.
    expect(config["features"]?.["agStudio"]).toBe("ag-studio");
    // No Channel3 key in this test env, so discovery must say so.
    expect(config["features"]?.["channel3"]).toBe("unconfigured");
    expect(config["features"]?.["bryntum"]).toBe("fallback-timeline");
    expect(config["transport"]).toBe("mock-simulated");
  });
});

describe("copilot flow: intent → offers → promise → approval", () => {
  it("parses NL intent, lists offers, creates and approves a promise", async () => {
    await reset();
    const intentRes = await post("/api/intents", {
      rawText: "Purchase three field sensor kits, budget under $500, delivery within 14 days.",
      buyerId: "buyer-demo",
    });
    expect(intentRes.status).toBe(201);
    const created = data<{ intent: { id: string; quantity: number; budget: { amountMinor: number; currency: string } }; parsed: { notes: string[] } }>(intentRes.json);
    expect(created.intent.quantity).toBe(3);
    expect(created.intent.budget.amountMinor).toBe(50000);
    expect(created.parsed.notes.length).toBeGreaterThan(0);

    const offersRes = await get(`/api/offers?intentId=${created.intent.id}`);
    expect(offersRes.status).toBe(200);
    const offers = data<{ origin: string; offers: { id: string; total: { amountMinor: number } }[] }>(offersRes.json);
    expect(offers.origin).toBe("simulated-catalog");
    expect(offers.offers.length).toBeGreaterThan(0);
    const first = offers.offers[0];
    if (first === undefined) throw new Error("expected an offer");

    const promiseRes = await post("/api/promises", { intentId: created.intent.id, offerId: first.id });
    expect(promiseRes.status).toBe(201);
    const promiseView = data<{ promise: { id: string; hash: string }; state: string; policy: { verdict: string } }>(promiseRes.json);
    expect(promiseView.state).toBe("AWAITING_APPROVAL");
    expect(promiseView.promise.hash).toMatch(/^[0-9a-f]{64}$/);

    const approveRes = await post(`/api/promises/${promiseView.promise.id}/approve`, { approvedBy: "buyer-demo" });
    expect(approveRes.status).toBe(200);
    const approved = data<{ state: string; policy: { verdict: string } }>(approveRes.json);
    expect(approved.state).toBe("APPROVED");
    expect(approved.policy.verdict).toBe("Cleared");
  });

  it("refuses over-budget promises and double approval", async () => {
    await reset();
    const intentRes = await post("/api/intents", { rawText: "Buy one cable.", buyerId: "b", budgetMinor: 100, currency: "USD" });
    const intent = data<{ intent: { id: string } }>(intentRes.json).intent;
    const offers = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json).offers;
    const first = offers[0];
    if (first === undefined) throw new Error("expected an offer");
    const over = await post("/api/promises", { intentId: intent.id, offerId: first.id });
    expect(over.status).toBe(422);
    expect(errCode(over.json)).toBe("over-budget");
  });
});

describe("payment + outcome + recovery", () => {
  it("runs order → capture → incident → refund → verified", async () => {
    await reset();
    const intent = data<{ intent: { id: string } }>(
      (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "b" })).json,
    ).intent;
    const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json).offers[0];
    if (offer === undefined) throw new Error("expected an offer");
    const promiseId = data<{ promise: { id: string } }>(
      (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
    ).promise.id;
    await post(`/api/promises/${promiseId}/approve`, { approvedBy: "b" });

    const orderRes = await post("/api/payments/orders", { promiseId });
    expect(orderRes.status).toBe(201);
    const orderBody = data<{ order: { id: string; status: string; providerOrderId: string; paypalRequestId: string }; transport: string }>(orderRes.json);
    expect(orderBody.transport).toBe("mock-simulated");
    expect(orderBody.order.status).toBe("created");

    // Idempotent replay with the same key returns the same order.
    // Note: the promise has moved to PAYMENT_PENDING, so only the original
    // key replays; a fresh key is correctly refused as wrong-state.
    const replay = await post("/api/payments/orders", { promiseId, idempotencyKey: orderBody.order.paypalRequestId });
    expect(replay.status).toBe(201);
    expect(data<{ duplicate: boolean }>(replay.json).duplicate).toBe(true);
    const freshKey = await post("/api/payments/orders", { promiseId, idempotencyKey: "order_test-fresh-key-2" });
    expect(freshKey.status).toBe(409);

    await post(`/api/payments/orders/${orderBody.order.id}/buyer-approve`, {});
    const captureRes = await post(`/api/payments/orders/${orderBody.order.id}/capture`, {});
    expect(captureRes.status).toBe(200);
    const txView = data<{ state: string }>((await get(`/api/promises/${promiseId}`)).json);
    expect(txView.state).toBe("OUTCOME_MONITORING");

    const outcomeRes = await post("/api/outcomes", {
      promiseId,
      kind: "delivery-scan",
      summary: "Carrier scan: 2 of 3 kits delivered.",
      payload: { deliveredQuantity: 2, status: "partial" },
      provenance: { source: "simulated-logistics" },
      confidence: 1,
    });
    expect(outcomeRes.status).toBe(201);
    const outcome = data<{ incidents: { id: string; category: string }[] }>(outcomeRes.json);
    expect(outcome.incidents).toHaveLength(1);
    const incidentId = outcome.incidents[0]?.id;
    if (incidentId === undefined) throw new Error("expected an incident");

    const proposalRes = await post("/api/resolutions", {
      incidentId,
      kind: "refund-partial",
      amount: { currency: "USD", amountMinor: 12999 },
      rationale: "One kit missing; refund one unit share.",
      proposedBy: "resolution-agent",
    });
    expect(proposalRes.status).toBe(201);
    const proposalId = (data<{ proposal: { id: string } }>(proposalRes.json)).proposal.id;

    const decideRes = await post(`/api/resolutions/${proposalId}/decide`, { decidedBy: "operator", decision: "approved" });
    expect(decideRes.status).toBe(200);
    const decided = data<{ state: string; refund: { status: string; providerRefundId: string; amount: { amountMinor: number } }; transport: string }>(decideRes.json);
    expect(decided.state).toBe("RESOLUTION_VERIFIED");
    expect(decided.refund.amount.amountMinor).toBe(12999);
    expect(decided.transport).toBe("mock-simulated");

    const auditRes = await get(`/api/audit?promiseId=${promiseId}`);
    const audit = data<{ entries: { type: string }[]; chainValid: boolean; total: number }>(auditRes.json);
    expect(audit.chainValid).toBe(true);
    expect(audit.total).toBeGreaterThan(8);
    const types = audit.entries.map((e) => e.type);
    expect(types).toContain("refund.verified");
    expect(types).toContain("incident.detected");
  });

  it("refuses capture before approval and over-refunds", async () => {
    await reset();
    const intent = data<{ intent: { id: string } }>(
      (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "b" })).json,
    ).intent;
    const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json).offers[0];
    if (offer === undefined) throw new Error("expected an offer");
    const promiseId = data<{ promise: { id: string } }>(
      (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
    ).promise.id;
    const early = await post("/api/payments/orders", { promiseId });
    expect(early.status).toBe(409);
    expect(errCode(early.json)).toBe("wrong-state");
  });
});

describe("kill switch", () => {
  it("refuses new payment ops while engaged, then recovers", async () => {
    await reset();
    const intent = data<{ intent: { id: string } }>(
      (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "b" })).json,
    ).intent;
    const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json).offers[0];
    if (offer === undefined) throw new Error("expected an offer");
    const promiseId = data<{ promise: { id: string } }>(
      (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
    ).promise.id;
    // Approval while the switch is engaged must be blocked by policy.
    await post("/api/admin/kill-switch", { engaged: true, actor: "test" });
    const blocked = await post(`/api/promises/${promiseId}/approve`, { approvedBy: "b" });
    expect(blocked.status).toBe(409);
    expect(errCode(blocked.json)).toBe("policy-blocked");
    // Reads stay open.
    expect((await get(`/api/promises/${promiseId}`)).status).toBe(200);
    await post("/api/admin/kill-switch", { engaged: false, actor: "test" });
    const approved = await post(`/api/promises/${promiseId}/approve`, { approvedBy: "b" });
    expect(approved.status).toBe(200);
  });
});

describe("demo scenarios", () => {
  it("runs the flagship Acts 1–9 to verified recovery", async () => {
    await reset();
    const runRes = await post("/api/demo/run", { scenario: "flagship", label: "test" });
    expect(runRes.status).toBe(201);
    const run = data<{ status: string; acts: { act: number; title: string; status: string; origin: string }[]; context: Record<string, string> }>(runRes.json);
    expect(run.status).toBe("completed");
    expect(run.acts).toHaveLength(9);
    expect(run.acts.map((a) => a.act)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(run.acts[7]?.status).toBe("passed"); // flight recorder chain valid
    expect(run.acts[8]?.status).toBe("passed"); // studio regenerated from live data
    expect(run.acts[8]?.origin).toBe("real-api");
    expect(run.acts[1]?.origin).toBe("mock-simulated"); // no Channel3 key: honest catalog fallback
    const promiseId = run.context["promiseId"];
    if (promiseId === undefined) throw new Error("expected promise context");
    const txView = data<{ state: string }>((await get(`/api/promises/${promiseId}`)).json);
    expect(txView.state).toBe("RESOLUTION_VERIFIED");
  });

  it("blocks both injection attempts and preserves evidence", async () => {
    await reset();
    const runRes = await post("/api/demo/run", { scenario: "injection", label: "test" });
    expect(runRes.status).toBe(201);
    const run = data<{ status: string; acts: { status: string }[]; context: Record<string, string> }>(runRes.json);
    expect(run.status).toBe("completed");
    expect(run.acts[0]?.status).toBe("blocked");
    expect(run.acts[1]?.status).toBe("blocked");
    const promiseA = run.context["promiseA"];
    if (promiseA === undefined) throw new Error("expected promiseA context");
    const audit = data<{ entries: { type: string; payload: { reasons?: string[] } }[] }>(
      (await get(`/api/audit?promiseId=${promiseA}&type=policy.blocked`)).json,
    );
    expect(audit.entries.length).toBeGreaterThan(0);
    expect(audit.entries[0]?.payload.reasons).toContain("merchant-unknown");
  });
});

describe("export + reset", () => {
  it("exports a redacted bundle with a validity flag", async () => {
    await reset();
    await post("/api/demo/run", { scenario: "flagship", label: "test" });
    const res = await fetch(url("/api/audit/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition") ?? "").toContain("attachment");
    const bundle = (await res.json()) as { chainValid: boolean; entries: unknown[]; transport: string; bundle: string };
    expect(bundle.bundle).toBe("afterpact-flight-recorder-export");
    expect(bundle.chainValid).toBe(true);
    expect(bundle.entries.length).toBeGreaterThan(10);
    expect(JSON.stringify(bundle)).not.toContain("PAYPAL_CLIENT_SECRET");
  });

  it("reset clears records and restarts the chain honestly", async () => {
    await reset();
    await post("/api/demo/run", { scenario: "flagship", label: "test" });
    const before = data<{ promiseCount: number }>((await get("/api/metrics")).json);
    expect(before.promiseCount).toBeGreaterThan(0);
    const resetRes = await post("/api/demo/reset", {});
    expect(resetRes.status).toBe(200);
    const after = data<{ promiseCount: number; openIncidentCount: number }>((await get("/api/metrics")).json);
    expect(after.promiseCount).toBe(0);
    expect(after.openIncidentCount).toBe(0);
    const audit = data<{ entries: { type: string }[]; chainValid: boolean }>((await get("/api/audit")).json);
    expect(audit.chainValid).toBe(true);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]?.type).toBe("demo.reset");
  });
});
