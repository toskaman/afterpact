import { z } from "zod";
import {
  fingerprintOf,
  type Capture,
  type Order,
  type RefundOperation,
} from "../../domain/src/index";
import type { PaymentAuditLog } from "./auditLog";
import {
  PayPalInvalidStateError,
  PayPalWebhookReplayError,
  PayPalWebhookVerificationError,
} from "./errors";
import type { PaymentStore } from "./store";
import type { PayPalTransport } from "./transport";
import { parentIdOfUpLink, PayPalMoneyWireSchema, wireToMoney } from "./wire";

export const PayPalWebhookEventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  resource_type: z.string().optional(),
  summary: z.string().optional(),
  resource: z.unknown(),
});
export type PayPalWebhookEvent = z.infer<typeof PayPalWebhookEventSchema>;

const WebhookLinkSchema = z.object({
  rel: z.string(),
  href: z.string(),
});

const OrderResourceSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1).optional(),
});

const CaptureResourceSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: PayPalMoneyWireSchema,
  custom_id: z.string().optional(),
  links: z.array(WebhookLinkSchema).optional(),
});

const RefundResourceSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: PayPalMoneyWireSchema,
  links: z.array(WebhookLinkSchema).optional(),
});

export type WebhookOutcome = "applied" | "duplicate" | "ignored";

export interface WebhookHandleResult {
  outcome: WebhookOutcome;
  eventType: string;
  eventId: string;
  transmissionId: string;
}

export interface WebhookHandlerDeps {
  transport: PayPalTransport;
  store: PaymentStore;
  audit: PaymentAuditLog;
  /** PayPal webhook id the signature is verified against. */
  webhookId: string;
  now?: () => string;
}

function header(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

/**
 * Webhook ingress: verify signature -> dedupe on transmission id ->
 * route to a transactional local state update. Unknown event types are
 * recorded and ignored (never an error: providers add types over time).
 */
export class WebhookHandler {
  private readonly now: () => string;

  constructor(private readonly deps: WebhookHandlerDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async handle(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<WebhookHandleResult> {
    const transmissionId = header(headers, "paypal-transmission-id");
    const timestamp = header(headers, "paypal-transmission-time");
    const certUrl = header(headers, "paypal-cert-url");
    const authAlgo = header(headers, "paypal-auth-algo");
    const transmissionSig = header(headers, "paypal-transmission-sig");
    if (
      transmissionId === undefined ||
      transmissionId === "" ||
      timestamp === undefined ||
      timestamp === "" ||
      transmissionSig === undefined ||
      transmissionSig === ""
    ) {
      throw new PayPalWebhookVerificationError(
        "missing PayPal webhook transmission headers",
      );
    }
    return this.deps.store.locks.runExclusive(
      `webhook:${transmissionId}`,
      async () => {
        const bodyFingerprint = fingerprintOf({ body: rawBody });
        const seen = this.deps.store.webhookTransmissions.get(transmissionId);
        if (seen !== undefined) {
          if (seen.bodyFingerprint !== bodyFingerprint) {
            throw new PayPalWebhookReplayError(transmissionId);
          }
          return {
            outcome: "duplicate" as const,
            eventType: seen.eventType,
            eventId: seen.eventId,
            transmissionId,
          };
        }
        const verified = await this.deps.transport.verifyWebhookSignature({
          transmissionId,
          timestamp,
          certUrl,
          authAlgo,
          transmissionSig,
          webhookId: this.deps.webhookId,
          body: rawBody,
        });
        if (!verified) {
          throw new PayPalWebhookVerificationError(
            `webhook signature verification failed for transmission ${transmissionId}`,
          );
        }
        let parsed: PayPalWebhookEvent;
        try {
          parsed = PayPalWebhookEventSchema.parse(
            JSON.parse(rawBody) as unknown,
          );
        } catch {
          throw new PayPalWebhookVerificationError(
            `webhook transmission ${transmissionId} carries a malformed event body`,
          );
        }
        const outcome = this.route(parsed);
        const receivedAt = this.now();
        this.deps.store.webhookTransmissions.set(transmissionId, {
          transmissionId,
          eventId: parsed.id,
          eventType: parsed.event_type,
          bodyFingerprint,
          receivedAt,
        });
        this.deps.audit.record({
          type: "paypal.webhook.received",
          payload: {
            transmissionId,
            eventId: parsed.id,
            eventType: parsed.event_type,
            outcome,
          },
        });
        return {
          outcome,
          eventType: parsed.event_type,
          eventId: parsed.id,
          transmissionId,
        };
      },
    );
  }

  private route(event: PayPalWebhookEvent): WebhookOutcome {
    switch (event.event_type) {
      case "CHECKOUT.ORDER.APPROVED":
        return this.onOrderApproved(event);
      case "CHECKOUT.ORDER.VOIDED":
        return this.onOrderVoided(event);
      case "PAYMENT.CAPTURE.COMPLETED":
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.PENDING":
        return this.onCaptureEvent(event);
      case "PAYMENT.CAPTURE.REFUNDED":
        return this.onRefundEvent(event);
      default:
        return "ignored";
    }
  }

  private onOrderApproved(event: PayPalWebhookEvent): WebhookOutcome {
    const resource = OrderResourceSchema.parse(event.resource);
    const localId = this.deps.store.ordersByProviderId.get(resource.id);
    if (localId === undefined) return "ignored";
    const order = this.mustGetOrder(localId);
    if (order.status === "created") {
      this.deps.store.putOrder({
        ...order,
        status: "approved",
        updatedAt: this.now(),
      });
      this.deps.audit.record({
        type: "paypal.order.approved",
        promiseId: order.promiseId,
        payload: { orderId: order.id, providerOrderId: resource.id },
      });
    }
    return "applied";
  }

  private onOrderVoided(event: PayPalWebhookEvent): WebhookOutcome {
    const resource = OrderResourceSchema.parse(event.resource);
    const localId = this.deps.store.ordersByProviderId.get(resource.id);
    if (localId === undefined) return "ignored";
    const order = this.mustGetOrder(localId);
    if (order.status === "created" || order.status === "approved") {
      this.deps.store.putOrder({
        ...order,
        status: "voided",
        updatedAt: this.now(),
      });
      this.deps.audit.record({
        type: "paypal.order.voided",
        promiseId: order.promiseId,
        payload: { orderId: order.id, providerOrderId: resource.id },
      });
    }
    return "applied";
  }

  private onCaptureEvent(event: PayPalWebhookEvent): WebhookOutcome {
    const resource = CaptureResourceSchema.parse(event.resource);
    const status =
      event.event_type === "PAYMENT.CAPTURE.COMPLETED"
        ? "completed"
        : event.event_type === "PAYMENT.CAPTURE.DENIED"
          ? "denied"
          : "pending";
    const knownId = this.deps.store.capturesByProviderId.get(resource.id);
    if (knownId !== undefined) {
      const capture = this.mustGetCapture(knownId);
      this.deps.store.putCapture({ ...capture, status });
      this.deps.audit.record({
        type: "paypal.capture.updated",
        promiseId: capture.promiseId,
        payload: {
          captureId: capture.id,
          providerCaptureId: resource.id,
          status,
        },
      });
      return "applied";
    }
    // Capture we did not initiate locally (e.g. provider-side capture):
    // link it via custom_id (our order id) or the order `up` link.
    const providerOrderId = parentIdOfUpLink(resource.links);
    const localOrderId =
      (resource.custom_id !== undefined
        ? this.deps.store.orders.get(resource.custom_id)?.id
        : undefined) ??
      (providerOrderId !== undefined
        ? this.deps.store.ordersByProviderId.get(providerOrderId)
        : undefined);
    if (localOrderId === undefined) return "ignored";
    const order = this.mustGetOrder(localOrderId);
    const capture: Capture = {
      id: `whcap-${event.id}`,
      orderId: order.id,
      promiseId: order.promiseId,
      providerCaptureId: resource.id,
      amount: order.amount,
      status,
      capturedAt: this.now(),
    };
    this.deps.store.putCapture(capture);
    if (status === "completed" && order.status !== "captured") {
      this.deps.store.putOrder({
        ...order,
        status: "captured",
        updatedAt: this.now(),
      });
    }
    this.deps.audit.record({
      type: "paypal.capture.observed",
      promiseId: order.promiseId,
      payload: {
        captureId: capture.id,
        providerCaptureId: resource.id,
        orderId: order.id,
        status,
      },
    });
    return "applied";
  }

  private onRefundEvent(event: PayPalWebhookEvent): WebhookOutcome {
    const resource = RefundResourceSchema.parse(event.resource);
    const knownId = this.deps.store.refundsByProviderId.get(resource.id);
    if (knownId !== undefined) {
      const refund = this.mustGetRefund(knownId);
      if (refund.status !== "succeeded") {
        this.deps.store.putRefund({
          ...refund,
          status: "succeeded",
          updatedAt: this.now(),
        });
        this.deps.audit.record({
          type: "paypal.refund.succeeded",
          promiseId: refund.promiseId,
          payload: {
            refundId: refund.id,
            providerRefundId: resource.id,
          },
        });
      }
      return "applied";
    }
    // Provider-side refund we did not initiate: link via capture `up` link.
    const providerCaptureId = parentIdOfUpLink(resource.links);
    const localCaptureId =
      providerCaptureId !== undefined
        ? this.deps.store.capturesByProviderId.get(providerCaptureId)
        : undefined;
    if (localCaptureId === undefined) return "ignored";
    const capture = this.mustGetCapture(localCaptureId);
    const refund: RefundOperation = {
      id: `whrfn-${event.id}`,
      captureId: capture.id,
      promiseId: capture.promiseId,
      // Exact provider amount from the verified webhook body — never the
      // full capture (a partial provider-side refund must not consume the
      // whole remaining balance in bounds math).
      amount: wireToMoney(resource.amount),
      reason: "provider-initiated refund observed via webhook",
      idempotencyKey: `webhook_${event.id}`.slice(0, 160),
      status: "succeeded",
      providerRefundId: resource.id,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.deps.store.putRefund(refund);
    this.deps.audit.record({
      type: "paypal.refund.observed",
      promiseId: capture.promiseId,
      payload: {
        refundId: refund.id,
        providerRefundId: resource.id,
        captureId: capture.id,
      },
    });
    return "applied";
  }

  private mustGetOrder(id: string): Order {
    const order = this.deps.store.orders.get(id);
    if (order === undefined) {
      throw new PayPalInvalidStateError(`order record ${id} vanished mid-update`);
    }
    return order;
  }

  private mustGetCapture(id: string): Capture {
    const capture = this.deps.store.captures.get(id);
    if (capture === undefined) {
      throw new PayPalInvalidStateError(
        `capture record ${id} vanished mid-update`,
      );
    }
    return capture;
  }

  private mustGetRefund(id: string): RefundOperation {
    const refund = this.deps.store.refunds.get(id);
    if (refund === undefined) {
      throw new PayPalInvalidStateError(
        `refund record ${id} vanished mid-update`,
      );
    }
    return refund;
  }
}

