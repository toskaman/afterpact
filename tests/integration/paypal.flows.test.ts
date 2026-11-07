import { describe, expect, it } from "vitest";
import {
  ApprovalExpiredError,
  CurrencyMismatchError,
  RefundBoundsError,
  sha256Hex,
} from "../../packages/domain/src/index";
import {
  MockPayPalTransport,
  PAYPAL_SANDBOX_BASE,
  PaymentAuditLog,
  PayPalConfigSchema,
  PayPalProviderError,
  PayPalReplayError,
  PayPalService,
  PayPalWebhookReplayError,
  PayPalWebhookVerificationError,
  PaymentStore,
} from "../../packages/payments/src/index";

const NOW = "2026-11-07T12:00:00.000Z";
const SECRET = "test-webhook-secret-123";
const USD_25 = { currency: "USD", amountMinor: 2500 };

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
  const service = new PayPalService({
    config,
    transport,
    store,
    audit,
    now: () => NOW,
  });
  return { transport, store, audit, service };
}

async function approvedOrder(ctx: ReturnType<typeof setup>, keyPrefix: string) {
  const created = await ctx.service.createOrder({
    promiseId: `${keyPrefix}-promise`,
    amount: USD_25,
    idempotencyKey: `${keyPrefix}-order-key`,
  });
  ctx.transport.approveOrder(created.value.providerOrderId ?? "");
  const refreshed = await ctx.service.getOrderStatus(created.value.id, {
    refresh: true,
  });
  return refreshed.order;
}

describe("paypal mocked flows", () => {
  it("runs create -> approve -> capture -> partial + full refund", async () => {
    const ctx = setup();
    const created = await ctx.service.createOrder({
      promiseId: "promise-1",
      amount: USD_25,
      idempotencyKey: "flow-order-key",
    });
    expect(created.duplicate).toBe(false);
    expect(created.value.status).toBe("created");
    expect(created.value.providerOrderId).toMatch(/^MOCK-ORDER-/);
    expect(created.value.approveUrl).toContain("paypal.com/checkoutnow");

    ctx.transport.approveOrder(created.value.providerOrderId ?? "");
    const status = await ctx.service.getOrderStatus(created.value.id, {
      refresh: true,
    });
    expect(status.order.status).toBe("approved");

    const captured = await ctx.service.captureOrder({
      orderId: created.value.id,
      idempotencyKey: "flow-capture-key",
    });
    expect(captured.duplicate).toBe(false);
    expect(captured.value.status).toBe("completed");
    expect((await ctx.service.getOrderStatus(created.value.id)).order.status).toBe(
      "captured",
    );

    const partial = await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "promise-1",
      amount: { currency: "USD", amountMinor: 1000 },
      reason: "partial: item missing",
      idempotencyKey: "flow-refund-1",
    });
    expect(partial.value.status).toBe("succeeded");
    expect(ctx.store.captures.get(captured.value.id)?.status).toBe(
      "partially-refunded",
    );

    const rest = await ctx.service.refundCapture({
      captureId: captured.value.id,
      promiseId: "promise-1",
      reason: "full remainder",
      idempotencyKey: "flow-refund-2",
    });
    expect(rest.value.amount).toEqual({ currency: "USD", amountMinor: 1500 });
    expect(ctx.store.captures.get(captured.value.id)?.status).toBe("refunded");

    const refundStatus = await ctx.service.getRefundStatus(rest.value.id, {
      refresh: true,
    });
    expect(refundStatus.refund.status).toBe("succeeded");
    expect(refundStatus.provider?.status).toBe("COMPLETED");

    expect(ctx.audit.verify()).toBe(true);
    expect(
      ctx.transport.calls.filter((c) => c.method === "createOrder"),
    ).toHaveLength(1);
  });

  it("replays the same idempotency key as a duplicate without new provider calls", async () => {
    const ctx = setup();
    const first = await ctx.service.createOrder({
      promiseId: "promise-dup",
      amount: USD_25,
      idempotencyKey: "dup-order-key",
    });
    const second = await ctx.service.createOrder({
      promiseId: "promise-dup",
      amount: USD_25,
      idempotencyKey: "dup-order-key",
    });
    expect(second.duplicate).toBe(true);
    expect(second.value.id).toBe(first.value.id);
    expect(
      ctx.transport.calls.filter((c) => c.method === "createOrder"),
    ).toHaveLength(1);
    const ops = [...ctx.store.operations.values()].filter(
      (op) => op.idempotencyKey === "dup-order-key",
    );
    expect(ops.map((op) => op.status).sort()).toEqual([
      "duplicate-skipped",
      "succeeded",
    ]);
  });

  it("refuses an idempotency key replayed with a different payload", async () => {
    const ctx = setup();
    await ctx.service.createOrder({
      promiseId: "promise-replay",
      amount: USD_25,
      idempotencyKey: "replay-key",
    });
    await expect(
      ctx.service.createOrder({
        promiseId: "promise-replay",
        amount: { currency: "USD", amountMinor: 9999 },
        idempotencyKey: "replay-key",
      }),
    ).rejects.toBeInstanceOf(PayPalReplayError);
  });

  it("rejects capture when provider currency drifts from the order", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "cur");
    ctx.transport.rewriteOrder(order.providerOrderId ?? "", {
      amount: { currency: "EUR", amountMinor: 2500 },
    });
    await expect(
      ctx.service.captureOrder({
        orderId: order.id,
        idempotencyKey: "cur-capture-key",
      }),
    ).rejects.toBeInstanceOf(CurrencyMismatchError);
  });

  it("rejects cross-currency refunds at the domain bound", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "cur2");
    const captured = await ctx.service.captureOrder({
      orderId: order.id,
      idempotencyKey: "cur2-capture-key",
    });
    await expect(
      ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "cur2-promise",
        amount: { currency: "EUR", amountMinor: 100 },
        reason: "wrong currency",
        idempotencyKey: "cur2-refund-key",
      }),
    ).rejects.toMatchObject({ name: "RefundBoundsError" });
  });

  it("rejects capture on an expired buyer approval", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "exp");
    const hash = sha256Hex("promise-exp");
    await expect(
      ctx.service.captureOrder(
        { orderId: order.id, idempotencyKey: "exp-capture-key" },
        {
          approval: {
            id: "approval-1",
            promiseId: "irrelevant",
            promiseVersion: 1,
            promiseHash: hash,
            approvedBy: "buyer",
            approvedAt: "2026-11-01T00:00:00.000Z",
            expiresAt: "2026-11-02T00:00:00.000Z",
            method: "manual",
          },
          promise: { id: "irrelevant", version: 1, hash },
        },
      ),
    ).rejects.toBeInstanceOf(ApprovalExpiredError);
  });

  it("rejects over-refunds locally and at the provider", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "ovr");
    const captured = await ctx.service.captureOrder({
      orderId: order.id,
      idempotencyKey: "ovr-capture-key",
    });
    try {
      await ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "ovr-promise",
        amount: { currency: "USD", amountMinor: 2501 },
        reason: "too much",
        idempotencyKey: "ovr-refund-key",
      });
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RefundBoundsError);
      expect((error as RefundBoundsError).code).toBe("refund-exceeds-captured");
    }
    await expect(
      ctx.transport.refundCapture({
        captureId: captured.value.providerCaptureId,
        amount: { currency: "USD", amountMinor: 9999 },
        requestId: "ovr-provider-key",
      }),
    ).rejects.toMatchObject({ providerCode: "REFUND_EXCEEDS_TRANSACTION_AMOUNT" });
  });

  it("serializes concurrent captures on the same key to one success + one duplicate", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "con");
    const [a, b] = await Promise.all([
      ctx.service.captureOrder({
        orderId: order.id,
        idempotencyKey: "con-capture-key",
      }),
      ctx.service.captureOrder({
        orderId: order.id,
        idempotencyKey: "con-capture-key",
      }),
    ]);
    const duplicates = [a.duplicate, b.duplicate].filter(Boolean);
    expect(duplicates).toHaveLength(1);
    expect(a.value.id).toBe(b.value.id);
    expect(
      ctx.transport.calls.filter((c) => c.method === "captureOrder"),
    ).toHaveLength(1);
  });

  it("serializes concurrent full refunds on the same key to one duplicate", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "conr");
    const captured = await ctx.service.captureOrder({
      orderId: order.id,
      idempotencyKey: "conr-capture-key",
    });
    const attempt = () =>
      ctx.service.refundCapture({
        captureId: captured.value.id,
        promiseId: "conr-promise",
        reason: "full refund race",
        idempotencyKey: "conr-refund-key",
      });
    const [a, b] = await Promise.all([attempt(), attempt()]);
    const duplicates = [a.duplicate, b.duplicate].filter(Boolean);
    expect(duplicates).toHaveLength(1);
    expect(a.value.id).toBe(b.value.id);
    expect(
      ctx.transport.calls.filter((c) => c.method === "refundCapture"),
    ).toHaveLength(1);
  });

  it("leaves no partial state when the provider capture fails", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "fail");
    ctx.transport.failNextWith(
      "captureOrder",
      new PayPalProviderError("boom", 500, "INTERNAL", true),
    );
    await expect(
      ctx.service.captureOrder({
        orderId: order.id,
        idempotencyKey: "fail-capture-1",
      }),
    ).rejects.toThrow("boom");
    expect(ctx.store.captures.size).toBe(0);
    expect(ctx.store.orders.get(order.id)?.status).toBe("approved");
    const ops = [...ctx.store.operations.values()];
    expect(ops.some((op) => op.status === "failed")).toBe(true);
    expect(
      ctx.audit.entries.some((e) => e.type === "paypal.capture.failed"),
    ).toBe(true);
    const retry = await ctx.service.captureOrder({
      orderId: order.id,
      idempotencyKey: "fail-capture-2",
    });
    expect(retry.duplicate).toBe(false);
    expect(retry.value.status).toBe("completed");
  });

  it("reconciles provider drift forward and reports currency mismatch", async () => {
    const ctx = setup();
    const order = await approvedOrder(ctx, "rec");
    // Buyer approved at the provider without a webhook: local is stale.
    const stale = await ctx.service.createOrder({
      promiseId: "rec-stale",
      amount: USD_25,
      idempotencyKey: "rec-stale-key",
    });
    ctx.transport.approveOrder(stale.value.providerOrderId ?? "");
    const report = await ctx.service.reconcileOrder(stale.value.id);
    expect(report.matches).toBe(false);
    expect(report.diffs.map((d) => d.field)).toContain("status");
    expect(report.repaired).toContain("status");
    expect(ctx.store.orders.get(stale.value.id)?.status).toBe("approved");

    ctx.transport.rewriteOrder(order.providerOrderId ?? "", {
      amount: { currency: "JPY", amountMinor: 2500 },
    });
    const mismatch = await ctx.service.reconcileOrder(order.id);
    expect(mismatch.matches).toBe(false);
    expect(mismatch.diffs.map((d) => d.field)).toContain("currency");
    expect(mismatch.repaired).not.toContain("currency");
  });
});

describe("paypal webhooks (mocked)", () => {
  it("applies an approval webhook once, then dedupes the redelivery", async () => {
    const ctx = setup();
    const created = await ctx.service.createOrder({
      promiseId: "promise-wh",
      amount: USD_25,
      idempotencyKey: "wh-order-key",
    });
    const delivery = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.APPROVED",
      { id: created.value.providerOrderId, status: "APPROVED" },
      { transmissionId: "trans-1" },
    );
    const first = await ctx.service.handleWebhook(delivery.headers, delivery.body);
    expect(first.outcome).toBe("applied");
    expect(ctx.store.orders.get(created.value.id)?.status).toBe("approved");
    const second = await ctx.service.handleWebhook(delivery.headers, delivery.body);
    expect(second.outcome).toBe("duplicate");
    expect(
      ctx.audit.entries.filter((e) => e.type === "paypal.order.approved"),
    ).toHaveLength(1);
  });

  it("rejects a transmission id replayed with a different body", async () => {
    const ctx = setup();
    const one = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.APPROVED",
      { id: "MOCK-ORDER-999", status: "APPROVED" },
      { transmissionId: "trans-replay" },
    );
    await ctx.service.handleWebhook(one.headers, one.body);
    const two = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.VOIDED",
      { id: "MOCK-ORDER-999", status: "VOIDED" },
      { transmissionId: "trans-replay" },
    );
    await expect(
      ctx.service.handleWebhook(two.headers, two.body),
    ).rejects.toBeInstanceOf(PayPalWebhookReplayError);
  });

  it("rejects tampered signatures and missing headers", async () => {
    const ctx = setup();
    const delivery = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.APPROVED",
      { id: "MOCK-ORDER-1" },
      { transmissionId: "trans-tamper" },
    );
    await expect(
      ctx.service.handleWebhook(
        { ...delivery.headers, "paypal-transmission-sig": "0".repeat(64) },
        delivery.body,
      ),
    ).rejects.toBeInstanceOf(PayPalWebhookVerificationError);
    await expect(
      ctx.service.handleWebhook({}, delivery.body),
    ).rejects.toBeInstanceOf(PayPalWebhookVerificationError);
  });

  it("ignores unknown event types without error", async () => {
    const ctx = setup();
    const delivery = ctx.transport.issueWebhook(
      "SOME.FUTURE.EVENT",
      { id: "x" },
      { transmissionId: "trans-unknown" },
    );
    const result = await ctx.service.handleWebhook(delivery.headers, delivery.body);
    expect(result.outcome).toBe("ignored");
  });

  it("links a provider-side capture via custom_id", async () => {
    const ctx = setup();
    const created = await ctx.service.createOrder({
      promiseId: "promise-side",
      amount: USD_25,
      idempotencyKey: "side-order-key",
    });
    const delivery = ctx.transport.issueWebhook(
      "PAYMENT.CAPTURE.COMPLETED",
      {
        id: "MOCK-CAPTURE-SIDE",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "25.00" },
        custom_id: created.value.id,
      },
      { transmissionId: "trans-side" },
    );
    const result = await ctx.service.handleWebhook(delivery.headers, delivery.body);
    expect(result.outcome).toBe("applied");
    expect(ctx.store.orders.get(created.value.id)?.status).toBe("captured");
    expect(
      ctx.store.capturesByProviderId.get("MOCK-CAPTURE-SIDE"),
    ).toBeDefined();
  });
});

