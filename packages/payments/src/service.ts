import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assertApprovalUsable,
  CurrencyMismatchError,
  fingerprintOf,
  NonNegativeMoneySchema,
  parseKey,
  validateRefundBounds,
  type Approval,
  type ApprovablePromise,
  type Capture,
  type Money,
  type Order,
  type PaymentOperation,
  type RefundOperation,
} from "../../domain/src/index";
import { evaluateRefund } from "../../policy/src/index";
import type { PaymentAuditLog } from "./auditLog";
import type { PayPalConfig } from "./config";
import {
  PayPalError,
  PayPalInvalidStateError,
  PayPalKillSwitchError,
  PayPalNotFoundError,
} from "./errors";
import {
  reconcileOrder as reconcileOrderRecords,
  reconcileRefund as reconcileRefundRecords,
  type ReconciliationReport,
} from "./reconcile";
import {
  mapProviderCaptureStatus,
  mapProviderOrderStatus,
  mapProviderRefundStatus,
} from "./status";
import type { PaymentStore } from "./store";
import type {
  PayPalTransport,
  ProviderCapture,
  ProviderOrder,
  ProviderRefund,
} from "./transport";
import { WebhookHandler, type WebhookHandleResult } from "./webhooks";

export const CreateOrderSchema = z.object({
  promiseId: z.string().min(1),
  amount: NonNegativeMoneySchema,
  idempotencyKey: z.string().min(1),
  customId: z.string().min(1).max(127).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;

export const CaptureOrderSchema = z.object({
  orderId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});
export type CaptureOrderRequest = z.infer<typeof CaptureOrderSchema>;

export interface CaptureApproval {
  approval: Approval;
  promise: ApprovablePromise;
}

export const RefundCaptureSchema = z.object({
  captureId: z.string().min(1),
  promiseId: z.string().min(1),
  /** Omitted amount means a full refund of the remaining balance. */
  amount: NonNegativeMoneySchema.optional(),
  reason: z.string().min(1).max(2000),
  idempotencyKey: z.string().min(1),
});
export type RefundCaptureRequest = z.infer<typeof RefundCaptureSchema>;

export interface DuplicateResult<T> {
  value: T;
  duplicate: boolean;
}

export interface OrderStatusResult {
  order: Order;
  provider?: ProviderOrder;
}

export interface RefundStatusResult {
  refund: RefundOperation;
  provider?: ProviderRefund;
}

export interface PayPalServiceDeps {
  config: PayPalConfig;
  transport: PayPalTransport;
  store: PaymentStore;
  audit: PaymentAuditLog;
  now?: () => string;
}

/**
 * Server-side PayPal facade. Owns every safety property in one place:
 * kill switch, idempotency + replay protection, per-record locks with
 * transactional updates, approval/currency/refund gates, secret-free audit.
 */
export class PayPalService {
  private readonly now: () => string;
  private killSwitch: boolean;
  private readonly webhooks: WebhookHandler;

  constructor(private readonly deps: PayPalServiceDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
    this.killSwitch = deps.config.killSwitch;
    this.webhooks = new WebhookHandler({
      transport: deps.transport,
      store: deps.store,
      audit: deps.audit,
      webhookId: deps.config.webhookId ?? "",
      now: this.now,
    });
  }

  get killSwitchEngaged(): boolean {
    return this.killSwitch;
  }

  setKillSwitch(engaged: boolean, actor = "operator"): void {
    this.killSwitch = engaged;
    this.deps.audit.record({
      type: "paypal.killswitch.changed",
      actor,
      payload: { engaged },
    });
  }

  /** Create a provider order and return the buyer approval URL. */
  async createOrder(
    raw: CreateOrderRequest,
  ): Promise<DuplicateResult<Order>> {
    const input = CreateOrderSchema.parse(raw);
    this.assertNewOpsAllowed("order-create");
    const key = parseKey(input.idempotencyKey);
    const fingerprint = fingerprintOf({
      kind: "order-create",
      promiseId: input.promiseId,
      amount: input.amount,
      customId: input.customId ?? null,
      returnUrl: input.returnUrl ?? null,
      cancelUrl: input.cancelUrl ?? null,
    });
    return this.deps.store.locks.runExclusive(
      `promise:${input.promiseId}`,
      async () => {
        const replay = this.deps.store.checkIdempotency<{ orderId: string }>(
          key,
          fingerprint,
        );
        if (replay.duplicate) {
          const order = this.mustGetOrder(replay.result?.orderId ?? "");
          this.recordDuplicateSkipped(
            "order-create",
            key,
            input.promiseId,
            input.amount,
          );
          return { value: order, duplicate: true };
        }
        const localId = randomUUID();
        const operationId = randomUUID();
        const startedAt = this.now();
        let provider: ProviderOrder;
        try {
          provider = await this.deps.transport.createOrder({
            amount: input.amount,
            requestId: key,
            customId: input.customId ?? localId,
            returnUrl: input.returnUrl,
            cancelUrl: input.cancelUrl,
          });
        } catch (error: unknown) {
          this.putOperation({
            id: operationId,
            kind: "order-create",
            idempotencyKey: key,
            promiseId: input.promiseId,
            status: "failed",
            amount: input.amount,
            error: errorMessage(error),
            createdAt: startedAt,
            updatedAt: this.now(),
          });
          this.deps.audit.record({
            type: "paypal.order.failed",
            promiseId: input.promiseId,
            level: "error",
            payload: {
              operationId,
              idempotencyKey: key,
              error: errorMessage(error),
            },
          });
          throw error;
        }
        assertSameCurrency(input.amount, provider.amount);
        const order: Order = {
          id: localId,
          promiseId: input.promiseId,
          provider: "paypal",
          providerOrderId: provider.id,
          approveUrl: provider.approveUrl,
          status: mapProviderOrderStatus(provider.status),
          amount: input.amount,
          paypalRequestId: key,
          createdAt: startedAt,
          updatedAt: this.now(),
        };
        this.deps.store.putOrder(order);
        this.putOperation({
          id: operationId,
          kind: "order-create",
          idempotencyKey: key,
          promiseId: input.promiseId,
          providerRef: provider.id,
          status: "succeeded",
          amount: input.amount,
          createdAt: startedAt,
          updatedAt: this.now(),
        });
        this.deps.store.recordIdempotency(
          key,
          `order:${localId}`,
          fingerprint,
          { orderId: localId },
          this.now(),
        );
        this.deps.audit.record({
          type: "paypal.order.created",
          promiseId: input.promiseId,
          payload: {
            orderId: localId,
            providerOrderId: provider.id,
            status: order.status,
            amount: input.amount,
            idempotencyKey: key,
          },
        });
        return { value: order, duplicate: false };
      },
    );
  }

  /**
   * Local order/payment status, optionally refreshed from the provider.
   * Refresh only moves local records forward; see the reconciler.
   * Reads stay available under the kill switch.
   */
  async getOrderStatus(
    orderId: string,
    options: { refresh?: boolean } = {},
  ): Promise<OrderStatusResult> {
    if (options.refresh !== true) {
      return { order: this.mustGetOrder(orderId) };
    }
    return this.deps.store.locks.runExclusive(`order:${orderId}`, async () => {
      const order = this.mustGetOrder(orderId);
      if (order.providerOrderId === undefined) return { order };
      const provider = await this.deps.transport.getOrder(order.providerOrderId);
      const mapped = mapProviderOrderStatus(provider.status);
      if (mapped !== order.status) {
        this.deps.store.putOrder({
          ...order,
          status: mapped,
          approveUrl: provider.approveUrl ?? order.approveUrl,
          updatedAt: this.now(),
        });
        this.deps.audit.record({
          type: "paypal.order.refreshed",
          promiseId: order.promiseId,
          payload: {
            orderId,
            from: order.status,
            to: mapped,
            providerOrderId: provider.id,
          },
        });
      }
      const current = this.mustGetOrder(orderId);
      return { order: current, provider };
    });
  }

  /**
   * Capture an approved order. Requires the domain buyer approval bound to
   * the exact promise version + hash (expiry enforced); refuses when local
   * and provider currencies disagree.
   */
  async captureOrder(
    raw: CaptureOrderRequest,
    approval?: CaptureApproval,
  ): Promise<DuplicateResult<Capture>> {
    const input = CaptureOrderSchema.parse(raw);
    this.assertNewOpsAllowed("order-capture");
    const key = parseKey(input.idempotencyKey);
    return this.deps.store.locks.runExclusive(
      `order:${input.orderId}`,
      async () => {
        const order = this.mustGetOrder(input.orderId);
        if (order.providerOrderId === undefined) {
          throw new PayPalInvalidStateError(
            `order ${order.id} has no provider order id`,
          );
        }
        // Idempotency first: a completed key replays its stored result even
        // though the order has since moved past "approved".
        const fingerprint = fingerprintOf({
          kind: "order-capture",
          orderId: order.id,
          providerOrderId: order.providerOrderId,
          amount: order.amount,
        });
        const replay = this.deps.store.checkIdempotency<{ captureId: string }>(
          key,
          fingerprint,
        );
        if (replay.duplicate) {
          const capture = this.mustGetCapture(replay.result?.captureId ?? "");
          this.recordDuplicateSkipped(
            "order-capture",
            key,
            order.promiseId,
            order.amount,
          );
          return { value: capture, duplicate: true };
        }
        if (order.status !== "approved") {
          throw new PayPalInvalidStateError(
            `order ${order.id} is ${order.status}: capture requires an approved order`,
          );
        }
        if (approval !== undefined) {
          assertApprovalUsable(
            approval.approval,
            approval.promise,
            this.now(),
          );
        }
        const operationId = randomUUID();
        const startedAt = this.now();
        let provider: ProviderCapture;
        try {
          provider = await this.deps.transport.captureOrder(
            order.providerOrderId,
            key,
          );
        } catch (error: unknown) {
          this.putOperation({
            id: operationId,
            kind: "order-capture",
            idempotencyKey: key,
            promiseId: order.promiseId,
            providerRef: order.providerOrderId,
            status: "failed",
            amount: order.amount,
            error: errorMessage(error),
            createdAt: startedAt,
            updatedAt: this.now(),
          });
          this.deps.audit.record({
            type: "paypal.capture.failed",
            promiseId: order.promiseId,
            level: "error",
            payload: {
              orderId: order.id,
              operationId,
              idempotencyKey: key,
              error: errorMessage(error),
            },
          });
          throw error;
        }
        assertSameCurrency(order.amount, provider.amount);
        const capture: Capture = {
          id: randomUUID(),
          orderId: order.id,
          promiseId: order.promiseId,
          providerCaptureId: provider.id,
          amount: order.amount,
          status: mapProviderCaptureStatus(provider.status),
          capturedAt: this.now(),
        };
        // Transactional update: capture + order + operation + idempotency
        // land together inside the order lock; nothing is absorption-safe
        // to persist before the provider confirms.
        this.deps.store.putCapture(capture);
        this.deps.store.putOrder({
          ...order,
          status: "captured",
          updatedAt: this.now(),
        });
        this.putOperation({
          id: operationId,
          kind: "order-capture",
          idempotencyKey: key,
          promiseId: order.promiseId,
          providerRef: provider.id,
          status: "succeeded",
          amount: order.amount,
          createdAt: startedAt,
          updatedAt: this.now(),
        });
        this.deps.store.recordIdempotency(
          key,
          `capture:${capture.id}`,
          fingerprint,
          { captureId: capture.id },
          this.now(),
        );
        this.deps.audit.record({
          type: "paypal.capture.completed",
          promiseId: order.promiseId,
          payload: {
            orderId: order.id,
            captureId: capture.id,
            providerCaptureId: provider.id,
            status: capture.status,
            amount: order.amount,
            idempotencyKey: key,
          },
        });
        return { value: capture, duplicate: false };
      },
    );
  }

  /**
   * Full (amount omitted) or partial refund of a settled capture.
   * Enforces domain refund bounds plus the policy refund gate.
   */
  async refundCapture(
    raw: RefundCaptureRequest,
  ): Promise<DuplicateResult<RefundOperation>> {
    const input = RefundCaptureSchema.parse(raw);
    this.assertNewOpsAllowed("refund");
    const key = parseKey(input.idempotencyKey);
    return this.deps.store.locks.runExclusive(
      `capture:${input.captureId}`,
      async () => {
        const capture = this.mustGetCapture(input.captureId);
        if (capture.promiseId !== input.promiseId) {
          throw new PayPalInvalidStateError(
            `capture ${capture.id} belongs to promise ${capture.promiseId}, not ${input.promiseId}`,
          );
        }
        // Idempotency first, fingerprinted on the raw request: a completed
        // key replays its stored result even though bounds/state moved on.
        // "FULL" marks amount-omitted (full-remainder) requests so their
        // replays match regardless of later refund activity.
        const fingerprint = fingerprintOf({
          kind: "refund",
          captureId: capture.id,
          providerCaptureId: capture.providerCaptureId,
          requestedAmount: input.amount ?? "FULL",
          reason: input.reason,
        });
        const replay = this.deps.store.checkIdempotency<{ refundId: string }>(
          key,
          fingerprint,
        );
        if (replay.duplicate) {
          const refund = this.mustGetRefund(replay.result?.refundId ?? "");
          this.recordDuplicateSkipped(
            "refund",
            key,
            input.promiseId,
            refund.amount,
          );
          return { value: refund, duplicate: true };
        }
        const alreadyRefundedMinor =
          this.deps.store.refundedMinorForCapture(capture.id);
        const remainingMinor =
          capture.amount.amountMinor - alreadyRefundedMinor;
        const requested: Money = input.amount ?? {
          currency: capture.amount.currency,
          amountMinor: remainingMinor,
        };
        validateRefundBounds({
          captured: capture.amount,
          alreadyRefundedMinor,
          requested,
        });
        const gate = evaluateRefund({
          now: this.now(),
          killSwitch: this.killSwitch,
          captured: capture.amount,
          alreadyRefundedMinor,
          requested,
        });
        if (gate.verdict !== "Cleared") {
          throw new PayPalError(
            `refund refused by policy: ${gate.reasons.join(", ")}`,
            "paypal-kill-switch",
          );
        }
        const refundId = randomUUID();
        const operationId = randomUUID();
        const startedAt = this.now();
        const pending: RefundOperation = {
          id: refundId,
          captureId: capture.id,
          promiseId: input.promiseId,
          amount: requested,
          reason: input.reason,
          idempotencyKey: key,
          status: "submitted",
          createdAt: startedAt,
          updatedAt: startedAt,
        };
        let provider: ProviderRefund;
        try {
          provider = await this.deps.transport.refundCapture({
            captureId: capture.providerCaptureId,
            amount: requested,
            requestId: key,
            note: input.reason,
          });
        } catch (error: unknown) {
          this.deps.store.putRefund({ ...pending, status: "failed", updatedAt: this.now() });
          this.putOperation({
            id: operationId,
            kind: "refund",
            idempotencyKey: key,
            promiseId: input.promiseId,
            status: "failed",
            amount: requested,
            error: errorMessage(error),
            createdAt: startedAt,
            updatedAt: this.now(),
          });
          this.deps.audit.record({
            type: "paypal.refund.failed",
            promiseId: input.promiseId,
            level: "error",
            payload: {
              refundId,
              captureId: capture.id,
              operationId,
              idempotencyKey: key,
              error: errorMessage(error),
            },
          });
          throw error;
        }
        assertSameCurrency(requested, provider.amount);
        const settled: RefundOperation = {
          ...pending,
          status: mapProviderRefundStatus(provider.status),
          providerRefundId: provider.id,
          updatedAt: this.now(),
        };
        const totalRefunded = alreadyRefundedMinor + requested.amountMinor;
        const captureStatus =
          totalRefunded >= capture.amount.amountMinor
            ? "refunded"
            : "partially-refunded";
        this.deps.store.putRefund(settled);
        if (settled.status === "succeeded" || settled.status === "submitted") {
          this.deps.store.putCapture({ ...capture, status: captureStatus });
        }
        this.putOperation({
          id: operationId,
          kind: "refund",
          idempotencyKey: key,
          promiseId: input.promiseId,
          providerRef: provider.id,
          status: "succeeded",
          amount: requested,
          createdAt: startedAt,
          updatedAt: this.now(),
        });
        this.deps.store.recordIdempotency(
          key,
          `refund:${refundId}`,
          fingerprint,
          { refundId },
          this.now(),
        );
        this.deps.audit.record({
          type: "paypal.refund.submitted",
          promiseId: input.promiseId,
          payload: {
            refundId,
            captureId: capture.id,
            providerRefundId: provider.id,
            status: settled.status,
            amount: requested,
            full: totalRefunded >= capture.amount.amountMinor,
            idempotencyKey: key,
          },
        });
        return { value: settled, duplicate: false };
      },
    );
  }

  /** Local refund status, optionally refreshed from the provider. */
  async getRefundStatus(
    refundId: string,
    options: { refresh?: boolean } = {},
  ): Promise<RefundStatusResult> {
    if (options.refresh !== true) {
      return { refund: this.mustGetRefund(refundId) };
    }
    return this.deps.store.locks.runExclusive(`refund:${refundId}`, async () => {
      const refund = this.mustGetRefund(refundId);
      if (refund.providerRefundId === undefined) return { refund };
      const provider = await this.deps.transport.getRefund(
        refund.providerRefundId,
      );
      const mapped = mapProviderRefundStatus(provider.status);
      if (mapped !== refund.status) {
        this.deps.store.putRefund({
          ...refund,
          status: mapped,
          updatedAt: this.now(),
        });
        this.deps.audit.record({
          type: "paypal.refund.refreshed",
          promiseId: refund.promiseId,
          payload: {
            refundId,
            from: refund.status,
            to: mapped,
            providerRefundId: provider.id,
          },
        });
      }
      return { refund: this.mustGetRefund(refundId), provider };
    });
  }

  /**
   * Webhook ingress. Provider-initiated state sync (not a new op), so it
   * stays open under the kill switch: it only moves local records toward
   * provider truth, never the reverse.
   */
  handleWebhook(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookHandleResult> {
    return this.webhooks.handle(headers, rawBody);
  }

  /** Provider reconciliation for one local order (read + local repair). */
  reconcileOrder(orderId: string): Promise<ReconciliationReport> {
    return reconcileOrderRecords(
      {
        transport: this.deps.transport,
        store: this.deps.store,
        audit: this.deps.audit,
        now: this.now,
      },
      orderId,
    );
  }

  /** Provider reconciliation for one local refund (read + local repair). */
  reconcileRefund(refundId: string): Promise<ReconciliationReport> {
    return reconcileRefundRecords(
      {
        transport: this.deps.transport,
        store: this.deps.store,
        audit: this.deps.audit,
        now: this.now,
      },
      refundId,
    );
  }

  private assertNewOpsAllowed(kind: string): void {
    if (this.killSwitch) {
      this.deps.audit.record({
        type: "paypal.killswitch.refused",
        level: "warn",
        payload: { kind },
      });
      throw new PayPalKillSwitchError(
        `kill switch engaged: refusing new ${kind} operation`,
      );
    }
  }

  private putOperation(operation: PaymentOperation): void {
    this.deps.store.putOperation(operation);
  }

  private recordDuplicateSkipped(
    kind: PaymentOperation["kind"],
    key: string,
    promiseId: string,
    amount: Money,
  ): void {
    const at = this.now();
    this.putOperation({
      id: randomUUID(),
      kind,
      idempotencyKey: key,
      promiseId,
      status: "duplicate-skipped",
      amount,
      createdAt: at,
      updatedAt: at,
    });
  }

  private mustGetOrder(id: string): Order {
    const order = this.deps.store.orders.get(id);
    if (order === undefined) {
      throw new PayPalNotFoundError(`order ${id} not found`);
    }
    return order;
  }

  private mustGetCapture(id: string): Capture {
    const capture = this.deps.store.captures.get(id);
    if (capture === undefined) {
      throw new PayPalNotFoundError(`capture ${id} not found`);
    }
    return capture;
  }

  private mustGetRefund(id: string): RefundOperation {
    const refund = this.deps.store.refunds.get(id);
    if (refund === undefined) {
      throw new PayPalNotFoundError(`refund ${id} not found`);
    }
    return refund;
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2000);
  return String(error).slice(0, 2000);
}



