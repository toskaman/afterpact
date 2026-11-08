#!/usr/bin/env node
/* Operator-impact benchmark: measures the AFTERPACT-assisted incident flow
 * (mock transport, :memory: store) step by step. Compares against the
 * documented manual procedure in docs/benchmarks/OPERATOR_IMPACT.md.
 *
 * Usage: BASE_URL=http://localhost:3052 node scripts/operator-benchmark.mjs
 * (start the API first with AFTERPACT_DATA_DIR=:memory: and mock transport)
 */
"use strict";

const BASE = process.env["BASE_URL"] ?? "http://localhost:3052";

async function post(path, body) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return { data: json.data, ms: Date.now() - started };
}

async function get(path) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return { data: json.data, ms: Date.now() - started };
}

const steps = [];
async function step(name, fn) {
  const started = Date.now();
  const out = await fn();
  const ms = Date.now() - started;
  steps.push({ step: name, ms });
  return out;
}

const run = await step("setup: intent->promise->approval->capture", async () => {
  const intent = await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500", buyerId: "bench" });
  const offers = await get(`/api/offers?intentId=${intent.data.intent.id}`);
  const promise = await post("/api/promises", { intentId: intent.data.intent.id, offerId: offers.data.offers[0].id });
  const pid = promise.data.promise.id;
  await post(`/api/promises/${pid}/approve`, { approvedBy: "bench" });
  const order = await post("/api/payments/orders", { promiseId: pid });
  await post(`/api/payments/orders/${order.data.order.id}/buyer-approve`, {});
  await post(`/api/payments/orders/${order.data.order.id}/capture`, {});
  return pid;
});

const incident = await step("1. record outcome -> incident detected", async () => {
  const outcome = await post("/api/outcomes", {
    promiseId: run, kind: "delivery-scan", summary: "Carrier scan: 2 of 3 kits delivered",
    payload: { deliveredQuantity: 2 }, provenance: { source: "manual" }, confidence: 0.9,
  });
  return outcome.data.incidents[0];
});

await step("2. diagnose (AI analysis + deterministic gaps)", async () => {
  await post("/api/ai/analyze-incident", { promiseId: run, observation: { deliveredQuantity: 2, note: incident.detail } });
});

const proposal = await step("3. operator proposes partial refund (1 decision)", async () => {
  const p = await post("/api/resolutions", {
    incidentId: incident.id, kind: "refund-partial",
    amount: { currency: "USD", amountMinor: 4333 },
    rationale: "One kit missing, refund its share.", proposedBy: "bench",
  });
  return p.data.proposal;
});

await step("4. operator approves -> refund executes + verifies (1 decision)", async () => {
  await post(`/api/resolutions/${proposal.id}/decide`, { decidedBy: "bench", decision: "approved" });
});

await step("5. verify in Flight Recorder (1 verification)", async () => {
  const audit = await get(`/api/audit?promiseId=${run}&limit=200`);
  if (audit.data.chainValid !== true) throw new Error("chain invalid");
  const verified = audit.data.entries.filter((e) => e.type === "refund.verified");
  if (verified.length !== 1) throw new Error("expected exactly one verified refund");
});

const operatorSteps = steps.filter((s) => /^[0-9]\./.test(s.step));
const total = operatorSteps.reduce((n, s) => n + s.ms, 0);
console.log(JSON.stringify({ transport: "mock", steps, operatorDecisions: 3, operatorMs: total }, null, 2));
