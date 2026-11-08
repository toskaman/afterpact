import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

let app: App;
let base = "";

function data<T>(json: unknown): T {
  return (json as { data: T }).data;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as unknown };
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, json: (await res.json()) as unknown };
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
      CHANNEL3_API_KEY: "",
      VULTR_INFERENCE_API_KEY: "",
      LOG_LEVEL: "silent",
    },
  });
  const port = await app.listen(0);
  base = `http://localhost:${port}`;
}, 30000);

afterAll(async () => {
  await app.close();
});

describe("AI status", () => {
  it("reports an unkeyed provider with an empty ledger", async () => {
    const res = await get("/api/ai/status");
    expect(res.status).toBe(200);
    const status = data<{
      keyed: boolean;
      provider: string | null;
      model: string | null;
      ledger: { calls: number; fallbacks: number };
    }>(res.json);
    expect(status.keyed).toBe(false);
    expect(status.provider).toBeNull();
    expect(status.ledger.calls).toBe(0);
  });
});

describe("AI-1 purchase intelligence", () => {
  it("analyzes intent with deterministic fallback provenance when unkeyed", async () => {
    const res = await post("/api/ai/analyze-intent", {
      rawText: "Purchase three field sensor kits, budget under $500, delivery within 14 days.",
      buyerId: "b",
    });
    expect(res.status).toBe(200);
    const body = data<{
      constraints: { quantity: number; budgetMinor: number | null; currency: string | null };
      ambiguities: string[];
      origin: string;
      provenance: { fallbackUsed: boolean };
    }>(res.json);
    expect(body.constraints.quantity).toBe(3);
    expect(body.constraints.budgetMinor).toBe(50000);
    expect(body.origin).toBe("heuristic-parse");
    expect(body.provenance.fallbackUsed).toBe(true);
  });

  it("rejects empty intent text", async () => {
    const res = await post("/api/ai/analyze-intent", { rawText: "   ", buyerId: "b" });
    expect(res.status).toBe(422);
  });
});

describe("AI-3 incident intelligence", () => {
  it("grounds analysis in detected gaps with verified citations", async () => {
    await reset();
    const intent = data<{ intent: { id: string } }>(
      (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "b" })).json,
    ).intent;
    const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json)
      .offers[0];
    if (offer === undefined) throw new Error("expected an offer");
    const promiseId = data<{ promise: { id: string } }>(
      (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
    ).promise.id;

    const res = await post("/api/ai/analyze-incident", {
      promiseId,
      observation: { deliveredQuantity: 2, status: "partial" },
    });
    expect(res.status).toBe(200);
    const body = data<{
      gaps: { category: string }[];
      citations: string[];
      droppedCitations: string[];
      provenance: { fallbackUsed: boolean };
    }>(res.json);
    expect(body.gaps.length).toBeGreaterThan(0);
    expect(body.gaps[0]?.category).toBe("not-delivered");
    // Every citation must resolve to a real record — nothing invented.
    expect(body.droppedCitations).toEqual([]);
    expect(body.provenance.fallbackUsed).toBe(true);
  });

  it("returns 404 for unknown promises", async () => {
    const res = await post("/api/ai/analyze-incident", {
      promiseId: "nope",
      observation: { deliveredQuantity: 1 },
    });
    expect(res.status).toBe(404);
  });
});

describe("AI-4 recovery planning", () => {
  it("recommends without executing and stays within bounds", async () => {
    await reset();
    const intent = data<{ intent: { id: string } }>(
      (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "b" })).json,
    ).intent;
    const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json)
      .offers[0];
    if (offer === undefined) throw new Error("expected an offer");
    const promiseId = data<{ promise: { id: string } }>(
      (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
    ).promise.id;
    await post(`/api/promises/${promiseId}/approve`, { approvedBy: "b" });
    const orderBody = data<{ order: { id: string } }>(
      (await post("/api/payments/orders", { promiseId })).json,
    );
    await post(`/api/payments/orders/${orderBody.order.id}/buyer-approve`, {});
    await post(`/api/payments/orders/${orderBody.order.id}/capture`, {});
    const outcome = data<{ incidents: { id: string }[] }>(
      (
        await post("/api/outcomes", {
          promiseId,
          kind: "delivery-scan",
          summary: "Carrier scan: 2 of 3 kits delivered.",
          payload: { deliveredQuantity: 2, status: "partial" },
          provenance: { source: "simulated-logistics" },
          confidence: 1,
        })
      ).json,
    );
    const incidentId = outcome.incidents[0]?.id;
    if (incidentId === undefined) throw new Error("expected an incident");

    const res = await post("/api/ai/plan-recovery", { incidentId });
    expect(res.status).toBe(200);
    const body = data<{
      strategy: string;
      amountMinor: number | null;
      gate: { verdict: string };
      executed: boolean;
      requiredApprovals: string[];
      provenance: { fallbackUsed: boolean };
    }>(res.json);
    expect(["partial-refund", "full-refund", "request-evidence", "escalate-human"]).toContain(body.strategy);
    expect(body.gate.verdict).not.toBe("refused");
    expect(body.executed).toBe(false);
    expect(body.requiredApprovals.length).toBeGreaterThan(0);

    // Planning must not persist proposals or move money by itself.
    const proposals = data<unknown[]>((await get("/api/resolutions")).json);
    expect(proposals).toEqual([]);
  });
});
