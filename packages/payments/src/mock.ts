import { createHmac, timingSafeEqual } from "node:crypto";
import {
  sha256Hex,
  type Money,
} from "../../domain/src/index";
import { PAYPAL_SANDBOX_CHECKOUT_BASE } from "./config";
import { PayPalProviderError } from "./errors";
import type {
  CreateOrderInput,
  PayPalTransport,
  ProviderCapture,
  ProviderOrder,
  ProviderRefund,
  RefundCaptureInput,
  WebhookVerifyInput,
} from "./transport";

export type MockOrderStatus = "CREATED" | "APPROVED" | "COMPLETED" | "VOIDED";
export type MockCaptureStatus =
  | "COMPLETED"
  | "DECLINED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";
export type MockRefundStatus = "COMPLETED" | "PENDING" | "FAILED";

interface MockOrder {
  id: string;
  status: MockOrderStatus;
  amount: Money;
  customId?: string;
  approveUrl: string;
  captureIds: string[];
  requestIds: string[];
}

interface MockCapture {
  id: string;
  orderId: string;
  status: MockCaptureStatus;
  amount: Money;
  customId?: string;
  refundedMinor: number;
}

interface MockRefund {
  id: string;
  captureId: string;
  status: MockRefundStatus;
  amount: Money;
}

export interface MockCall {
  method: string;
  requestId?: string;
}

/**
 * HMAC test signature for mock webhooks. Real PayPal verification uses the
 * verify-webhook-signature API (see HttpPayPalTransport); this scheme exists
 * so tests exercise the same sign -> verify -> dedupe path offline.
 */
export function mockWebhookSignature(
  secret: string,
  transmissionId: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${transmissionId}\n${timestamp}\n${sha256Hex(body)}`, "utf8")
    .digest("hex");
}

/**
 * In-memory Orders v2 simulation: deterministic ids, provider-side
 * PayPal-Request-Id idempotency, buyer-approval simulation, and refund
 * bounds. No network. Fault injection via `failNextWith`.
 */
export class MockPayPalTransport implements PayPalTransport {
  private seq = 1;
  private readonly orders = new Map<string, MockOrder>();
  private readonly ordersByRequestId = new Map<string, string>();
  private readonly captures = new Map<string, MockCapture>();
  private readonly capturesByRequestId = new Map<string, string>();
  private readonly refunds = new Map<string, MockRefund>();
  private readonly refundsByRequestId = new Map<string, string>();
  private readonly faults = new Map<string, PayPalProviderError>();

  /** Observable call log so tests can assert exact provider traffic. */
  readonly calls: MockCall[] = [];

  constructor(
    private readonly webhookSecret: string = "",
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Next call to `method` fails with `error` (one shot). */
  failNextWith(method: string, error: PayPalProviderError): void {
    this.faults.set(method, error);
  }

  /** Simulate the buyer clicking the approval URL. */
  approveOrder(providerOrderId: string): ProviderOrder {
    const order = this.mustGetOrder(providerOrderId);
    if (order.status !== "CREATED") {
      throw new PayPalProviderError(
        `order ${providerOrderId} is ${order.status}, cannot approve`,
        422,
        "ORDER_ALREADY_APPROVED",
        false,
      );
    }
    order.status = "APPROVED";
    return this.toProviderOrder(order);
  }

  /** Simulate buyer-side expiry / void of an unapproved order. */
  voidOrder(providerOrderId: string): ProviderOrder {
    const order = this.mustGetOrder(providerOrderId);
    if (order.status !== "CREATED" && order.status !== "APPROVED") {
      throw new PayPalProviderError(
        `order ${providerOrderId} is ${order.status}, cannot void`,
        422,
        "ORDER_CANNOT_BE_VOIDED",
        false,
      );
    }
    order.status = "VOIDED";
    return this.toProviderOrder(order);
  }

  /**
   * Test hook: rewrite what the provider reports (currency drift, status
   * drift) to exercise mismatch and reconciliation paths.
   */
  rewriteOrder(providerOrderId: string, patch: { amount?: Money }): void {
    const order = this.mustGetOrder(providerOrderId);
    if (patch.amount !== undefined) order.amount = patch.amount;
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    this.record("createOrder", input.requestId);
    this.throwFault("createOrder");
    const replay = this.ordersByRequestId.get(input.requestId);
    if (replay !== undefined) return this.toProviderOrder(this.mustGetOrder(replay));
    const id = `MOCK-ORDER-${this.seq++}`;
    const order: MockOrder = {
      id,
      status: "CREATED",
      amount: { ...input.amount },
      customId: input.customId,
      approveUrl: `${PAYPAL_SANDBOX_CHECKOUT_BASE}?token=${id}`,
      captureIds: [],
      requestIds: [input.requestId],
    };
    this.orders.set(id, order);
    this.ordersByRequestId.set(input.requestId, id);
    return this.toProviderOrder(order);
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    this.record("getOrder");
    this.throwFault("getOrder");
    return this.toProviderOrder(this.mustGetOrder(providerOrderId));
  }

  async captureOrder(
    providerOrderId: string,
    requestId: string,
  ): Promise<ProviderCapture> {
    this.record("captureOrder", requestId);
    this.throwFault("captureOrder");
    const replay = this.capturesByRequestId.get(requestId);
    if (replay !== undefined) return this.toProviderCapture(this.mustGetCapture(replay));
    const order = this.mustGetOrder(providerOrderId);
    if (order.status !== "APPROVED") {
      throw new PayPalProviderError(
        `order ${providerOrderId} is ${order.status}: buyer approval required before capture`,
        422,
        "ORDER_NOT_APPROVED",
        false,
      );
    }
    const id = `MOCK-CAPTURE-${this.seq++}`;
    const capture: MockCapture = {
      id,
      orderId: order.id,
      status: "COMPLETED",
      amount: { ...order.amount },
      customId: order.customId,
      refundedMinor: 0,
    };
    this.captures.set(id, capture);
    this.capturesByRequestId.set(requestId, id);
    order.captureIds.push(id);
    order.status = "COMPLETED";
    return this.toProviderCapture(capture);
  }

  async refundCapture(input: RefundCaptureInput): Promise<ProviderRefund> {
    this.record("refundCapture", input.requestId);
    this.throwFault("refundCapture");
    const replay = this.refundsByRequestId.get(input.requestId);
    if (replay !== undefined) return this.toProviderRefund(this.mustGetRefund(replay));
    const capture = this.mustGetCapture(input.captureId);
    if (capture.status === "DECLINED" || capture.status === "REFUNDED") {
      throw new PayPalProviderError(
        `capture ${input.captureId} is ${capture.status}, cannot refund`,
        422,
        "CAPTURE_CANNOT_BE_REFUNDED",
        false,
      );
    }
    const remaining = capture.amount.amountMinor - capture.refundedMinor;
    const requested =
      input.amount === undefined ? remaining : input.amount.amountMinor;
    if (input.amount !== undefined && input.amount.currency !== capture.amount.currency) {
      throw new PayPalProviderError(
        `refund currency ${input.amount.currency} does not match capture ${capture.amount.currency}`,
        422,
        "REFUND_CURRENCY_MISMATCH",
        false,
      );
    }
    if (requested <= 0 || requested > remaining) {
      throw new PayPalProviderError(
        `refund of ${requested} exceeds remaining ${remaining}`,
        422,
        "REFUND_EXCEEDS_TRANSACTION_AMOUNT",
        false,
      );
    }
    const id = `MOCK-REFUND-${this.seq++}`;
    const refund: MockRefund = {
      id,
      captureId: capture.id,
      status: "COMPLETED",
      amount: {
        currency: capture.amount.currency,
        amountMinor: requested,
      },
    };
    this.refunds.set(id, refund);
    this.refundsByRequestId.set(input.requestId, id);
    capture.refundedMinor += requested;
    capture.status =
      capture.refundedMinor >= capture.amount.amountMinor
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";
    return this.toProviderRefund(refund);
  }

  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    this.record("getRefund");
    this.throwFault("getRefund");
    return this.toProviderRefund(this.mustGetRefund(providerRefundId));
  }

  async verifyWebhookSignature(
    input: WebhookVerifyInput,
  ): Promise<boolean> {
    this.record("verifyWebhookSignature");
    if (this.webhookSecret === "") return false;
    const expected = mockWebhookSignature(
      this.webhookSecret,
      input.transmissionId,
      input.timestamp,
      input.body,
    );
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(input.transmissionSig, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Issue a signed webhook delivery for tests. Returns headers + raw body
   * ready for the service webhook entrypoint.
   */
  issueWebhook(
    eventType: string,
    resource: unknown,
    options: { transmissionId?: string; timestamp?: string } = {},
  ): { headers: Record<string, string>; body: string } {
    const transmissionId =
      options.transmissionId ?? `MOCK-TRANS-${this.seq++}`;
    const timestamp = options.timestamp ?? this.now();
    const body = JSON.stringify({
      id: `MOCK-EVENT-${this.seq++}`,
      event_type: eventType,
      resource_type: "mock",
      resource,
    });
    return {
      headers: {
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-time": timestamp,
        "paypal-cert-url": "https://api.sandbox.paypal.com/certs/mock",
        "paypal-auth-algo": "MOCK-HMAC-SHA256",
        "paypal-transmission-sig": mockWebhookSignature(
          this.webhookSecret,
          transmissionId,
          timestamp,
          body,
        ),
      },
      body,
    };
  }

  private record(method: string, requestId?: string): void {
    this.calls.push(
      requestId === undefined ? { method } : { method, requestId },
    );
  }

  private throwFault(method: string): void {
    const fault = this.faults.get(method);
    if (fault !== undefined) {
      this.faults.delete(method);
      throw fault;
    }
  }

  private mustGetOrder(id: string): MockOrder {
    const order = this.orders.get(id);
    if (order === undefined) {
      throw new PayPalProviderError(`order ${id} not found`, 404, "ORDER_NOT_FOUND", false);
    }
    return order;
  }

  private mustGetCapture(id: string): MockCapture {
    const capture = this.captures.get(id);
    if (capture === undefined) {
      throw new PayPalProviderError(
        `capture ${id} not found`,
        404,
        "CAPTURE_NOT_FOUND",
        false,
      );
    }
    return capture;
  }

  private mustGetRefund(id: string): MockRefund {
    const refund = this.refunds.get(id);
    if (refund === undefined) {
      throw new PayPalProviderError(
        `refund ${id} not found`,
        404,
        "REFUND_NOT_FOUND",
        false,
      );
    }
    return refund;
  }

  private toProviderOrder(order: MockOrder): ProviderOrder {
    return {
      id: order.id,
      status: order.status,
      amount: { ...order.amount },
      approveUrl: order.approveUrl,
      captures: order.captureIds.map((id) =>
        this.toProviderCapture(this.mustGetCapture(id)),
      ),
      raw: { mock: true, id: order.id, status: order.status },
    };
  }

  private toProviderCapture(capture: MockCapture): ProviderCapture {
    return {
      id: capture.id,
      status: capture.status,
      amount: { ...capture.amount },
      customId: capture.customId,
      raw: { mock: true, id: capture.id, status: capture.status },
    };
  }

  private toProviderRefund(refund: MockRefund): ProviderRefund {
    return {
      id: refund.id,
      status: refund.status,
      amount: { ...refund.amount },
      raw: { mock: true, id: refund.id, status: refund.status },
    };
  }
}

