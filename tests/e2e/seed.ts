import type { APIRequestContext } from "@playwright/test";

async function post(request: APIRequestContext, path: string, body: unknown): Promise<any> {
  const res = await request.post(path, { data: body });
  if (!res.ok()) throw new Error(`POST ${path} -> ${res.status()}: ${await res.text()}`);
  return (await res.json()).data;
}

/** Seeds intent -> promise -> approval -> capture -> short-delivery incident. */
export async function seedIncident(request: APIRequestContext): Promise<{ promiseId: string; incidentId: string }> {
  const intent = await post(request, "/api/intents", {
    rawText: "Purchase three field sensor kits, budget under $500",
    buyerId: "e2e",
  });
  const offers = (await (await request.get(`/api/offers?intentId=${intent.intent.id}`)).json()).data;
  const promise = await post(request, "/api/promises", { intentId: intent.intent.id, offerId: offers.offers[0].id });
  const promiseId = promise.promise.id as string;
  await post(request, `/api/promises/${promiseId}/approve`, { approvedBy: "e2e" });
  const order = await post(request, "/api/payments/orders", { promiseId });
  await post(request, `/api/payments/orders/${order.order.id}/buyer-approve`, {});
  await post(request, `/api/payments/orders/${order.order.id}/capture`, {});
  const outcome = await post(request, "/api/outcomes", {
    promiseId,
    kind: "delivery-scan",
    summary: "Carrier scan: 2 of 3 kits delivered",
    payload: { deliveredQuantity: 2 },
    provenance: { source: "manual" },
    confidence: 0.9,
  });
  return { promiseId, incidentId: outcome.incidents[0].id as string };
}

/** Seeds the incident above plus a proposed + approved partial refund. */
export async function seedVerifiedRecovery(request: APIRequestContext): Promise<{ promiseId: string; incidentId: string }> {
  const { promiseId, incidentId } = await seedIncident(request);
  const proposal = await post(request, "/api/resolutions", {
    incidentId,
    kind: "refund-partial",
    amount: { currency: "USD", amountMinor: 4333 },
    rationale: "One kit missing, refund its share.",
    proposedBy: "e2e",
  });
  await post(request, `/api/resolutions/${proposal.proposal.id}/decide`, { decidedBy: "e2e", decision: "approved" });
  return { promiseId, incidentId };
}

/** Fails the test on any uncaught page exception. */
export function collectPageErrors(page: { on(event: string, fn: (e: Error) => void): void }): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  return errors;
}
