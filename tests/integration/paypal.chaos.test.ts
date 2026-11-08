import { describe, expect, it } from "vitest";
import { RefundBoundsError } from "../../packages/domain/src/index";
import {
  MockPayPalTransport,
  PAYPAL_SANDBOX_BASE,
  PaymentAuditLog,
  PayPalConfigSchema,
  PayPalProviderError,
  PayPalService,
  PaymentStore,
} from "../../packages/payments/src/index";

/**
 * TITAN III chaos campaign: seeded, deterministic fault injection over the
 * mocked provider. No network, no sleeps, no real money. Each test asserts a
 * fail-closed invariant: at most one provider-side effect per idempotency
 * key, no partial local state on provider failure, bounds hold under races.
 */
const NOW = "2026-11-08T12:00:00.000Z";
const SECRET = "test-webhook-secret-123";
const USD_25 = { currency: "USD", amountMinor: 2500 };
const REASON = "chaos probe";

function setup() {
  const transport = new MockPayPalTransport(SECRET, () => NOW);
  const store = new PaymentStore();
  const audit = new PaymentAuditLog();
  const config = PayPalConfigSchema.parse({
    mode: "sandbox",
    apiBase: PAYPAL_SANDBOX_BASE,
    clientId: "test-client",
    webhookId: "WH-TEST",
  });
  const service = new PayPalService({ config, transport, store, audit, now: () => NOW });
  return { transport, store, audit, service };
}

async function approvedOrder(ctx: ReturnType<typeof setup>, keyPrefix: string) {
  const created = await ctx.service.createOrder({
    promiseId: `${keyPrefix}-promise`,
    amount: USD_25,
    idempotencyKey: `${keyPrefix}-order-key`,
  });
  ctx.transport.approveOrder(created.value.providerOrderId ?? "");
  const refreshed = await ctx.service.getOrderStatus(created.value.id, { refresh: true });
  return refreshed.order;
}

function callsOf(ctx: ReturnType<typeof setup>, method: string): number {
  return ctx.transport.calls.filter((c) => c.method === method).length;
}

describe("paypal chaos: retry storms", () => {
  it("replays 25 sequential same-key captures with zero new provider calls", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "storm");
    const first = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "storm-cap" });
    expect(first.duplicate).toBe(false);
    expect(callsOf(ctx, "captureOrder")).toBe(1);
    for (let i = 0; i < 25; i += 1) {
      const replay = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "storm-cap" });
      expect(replay.duplicate).toBe(true);
      expect(replay.value.id).toBe(first.value.id);
    }
    expect(callsOf(ctx, "captureOrder")).toBe(1);
    expect(ctx.store.captures.size).toBe(1);
  });

  it("absorbs 20 parallel same-key captures into one capture", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "blast");
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "blast-cap" }),
      ),
    );
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(new Set(results.map((r) => r.value.id)).size).toBe(1);
    expect(callsOf(ctx, "captureOrder")).toBe(1);
    expect(ctx.store.captures.size).toBe(1);
  });
});

describe("paypal chaos: racing refunds vs bounds", () => {
  it("lets exactly one of two racing 2000c refunds win on a 2500c capture", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "race");
    const captured = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "race-cap" });
    const attempts = await Promise.allSettled([
      ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "race-promise",
        amount: { currency: "USD", amountMinor: 2000 },
        reason: REASON,
        idempotencyKey: "race-refund-1",
      }),
      ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "race-promise",
        amount: { currency: "USD", amountMinor: 2000 },
        reason: REASON,
        idempotencyKey: "race-refund-2",
      }),
    ]);
    const won = attempts.filter((a) => a.status === "fulfilled");
    const lost = attempts.filter((a) => a.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(RefundBoundsError);
    const total = [...ctx.store.refunds.values()]
      .filter((r) => r.captureId === captured.value.id)
      .reduce((sum, r) => sum + r.amount.amountMinor, 0);
    expect(total).toBe(2000);
  });

  it("drains remaining capture exactly, then refuses the next cent", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "drain");
    const captured = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "drain-cap" });
    await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "drain-promise",
      amount: { currency: "USD", amountMinor: 1000 },
      reason: REASON,
      idempotencyKey: "drain-r1",
    });
    const last = await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "drain-promise",
      amount: { currency: "USD", amountMinor: 1500 },
      reason: REASON,
      idempotencyKey: "drain-r2",
    });
    expect(last.duplicate).toBe(false);
    await expect(
      ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "drain-promise",
        amount: { currency: "USD", amountMinor: 1 },
        reason: REASON,
        idempotencyKey: "drain-r3",
      }),
    ).rejects.toBeInstanceOf(RefundBoundsError);
  });
});

describe("paypal chaos: provider faults", () => {
  it("surfaces a 500 capture fault retryably with no partial state, then succeeds", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "fault500");
    ctx.transport.failNextWith("captureOrder", new PayPalProviderError("boom", 500, "INTERNAL", true));
    const failed = await ctx.service
      .captureOrder({ orderId: order.id, idempotencyKey: "fault500-cap" })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(failed).toBeInstanceOf(PayPalProviderError);
    expect((failed as PayPalProviderError).retryable).toBe(true);
    expect(ctx.store.captures.size).toBe(0);
    const retry = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "fault500-cap" });
    expect(retry.duplicate).toBe(false);
    expect(retry.value.status).toBe("completed");
  });

  it("surfaces a 429 refund fault retryably with no refund record, then succeeds", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "fault429");
    const captured = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "fault429-cap" });
    ctx.transport.failNextWith(
      "refundCapture",
      new PayPalProviderError("rate limited", 429, "RATE_LIMIT", true),
    );
    const failed = await ctx.service
      .refundCapture({
        captureId: captured.value.id,
        promiseId: "fault429-promise",
        amount: { currency: "USD", amountMinor: 500 },
        reason: REASON,
        idempotencyKey: "fault429-r",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(failed).toBeInstanceOf(PayPalProviderError);
    expect((failed as PayPalProviderError).retryable).toBe(true);
    // The attempt is journaled as a failed marker (audit trail), but failed
    // markers consume no bounds: the same-key retry settles in full.
    expect(ctx.store.refunds.size).toBe(1);
    expect([...ctx.store.refunds.values()][0]?.status).toBe("failed");
    const retry = await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "fault429-promise",
      amount: { currency: "USD", amountMinor: 500 },
      reason: REASON,
      idempotencyKey: "fault429-r",
    });
    expect(retry.duplicate).toBe(false);
    expect(retry.value.status).toBe("succeeded");
  });

  it("recovers a failed createOrder on same-key retry without a duplicate order", async () => {
    const ctx = setup();
    ctx.transport.failNextWith(
      "createOrder",
      new PayPalProviderError("gateway timeout", 504, "TIMEOUT", true),
    );
    await expect(
      ctx.service.createOrder({
        promiseId: "faultcreate-promise",
        amount: USD_25,
        idempotencyKey: "faultcreate-key",
      }),
    ).rejects.toBeInstanceOf(PayPalProviderError);
    const retry = await ctx.service.createOrder({
      promiseId: "faultcreate-promise",
      amount: USD_25,
      idempotencyKey: "faultcreate-key",
    });
    expect(retry.duplicate).toBe(false);
    expect(ctx.store.orders.size).toBe(1);
  });
});

describe("paypal chaos: webhook disorder", () => {
  it("ignores a refund webhook for an unknown capture, then links it once the capture lands", async () => {
    const ctx = setup();
    const early = ctx.transport.issueWebhook(
      "PAYMENT.CAPTURE.REFUNDED",
      {
        id: "MOCK-REFUND-early",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "5.00" },
      },
      { transmissionId: "trans-early" },
    );
    const first = await ctx.service.handleWebhook(early.headers, early.body);
    expect(first.outcome).toBe("ignored");

    const order = await approvedOrder(ctx, "late-link");
    const captured = await ctx.service.captureOrder({ orderId: order.id, idempotencyKey: "late-link-cap" });
    const refund = await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "late-link-promise",
      amount: { currency: "USD", amountMinor: 500 },
      reason: REASON,
      idempotencyKey: "late-link-r",
    });
    const providerRefundId = refund.value.providerRefundId ?? "";
    expect(providerRefundId).not.toBe("");
    const late = ctx.transport.issueWebhook(
      "PAYMENT.CAPTURE.REFUNDED",
      {
        id: providerRefundId,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "5.00" },
      },
      { transmissionId: "trans-late" },
    );
    const second = await ctx.service.handleWebhook(late.headers, late.body);
    expect(second.outcome).not.toBe("ignored");
  });

  it("applies an approval webhook once across 5 redeliveries", async () => {
    const ctx = setup();
    const created = await ctx.service.createOrder({
      promiseId: "promise-redeliver",
      amount: USD_25,
      idempotencyKey: "redeliver-order-key",
    });
    const delivery = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.APPROVED",
      { id: created.value.providerOrderId, status: "APPROVED" },
      { transmissionId: "trans-redeliver" },
    );
    const outcomes: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      outcomes.push((await ctx.service.handleWebhook(delivery.headers, delivery.body)).outcome);
    }
    expect(outcomes).toEqual(["applied", "duplicate", "duplicate", "duplicate", "duplicate"]);
    expect(ctx.audit.entries.filter((e) => e.type === "paypal.order.approved")).toHaveLength(1);
  });
});
