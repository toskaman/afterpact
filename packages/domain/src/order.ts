import { z } from "zod";
import { NonNegativeMoneySchema } from "./money";
import { IdempotencyKeySchema } from "./idempotency";

export const OrderStatusSchema = z.enum([
  "created",
  "approved",
  "captured",
  "voided",
  "failed",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/** Our record of a provider checkout order (PayPal Orders v2). */
export const OrderSchema = z.object({
  id: z.string().min(1),
  promiseId: z.string().min(1),
  provider: z.literal("paypal"),
  providerOrderId: z.string().min(1).optional(),
  approveUrl: z.string().url().optional(),
  status: OrderStatusSchema,
  amount: NonNegativeMoneySchema,
  /** Sent as PayPal-Request-Id on write calls. */
  paypalRequestId: IdempotencyKeySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const PaymentOperationKindSchema = z.enum([
  "order-create",
  "order-capture",
  "refund",
  "void",
]);
export type PaymentOperationKind = z.infer<typeof PaymentOperationKindSchema>;

export const PaymentOperationStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "duplicate-skipped",
]);
export type PaymentOperationStatus = z.infer<typeof PaymentOperationStatusSchema>;

/** One mutating provider call, deduplicated by its idempotency key. */
export const PaymentOperationSchema = z.object({
  id: z.string().min(1),
  kind: PaymentOperationKindSchema,
  idempotencyKey: IdempotencyKeySchema,
  promiseId: z.string().min(1),
  providerRef: z.string().min(1).optional(),
  status: PaymentOperationStatusSchema,
  amount: NonNegativeMoneySchema,
  error: z.string().max(2000).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PaymentOperation = z.infer<typeof PaymentOperationSchema>;

export const CaptureStatusSchema = z.enum([
  "pending",
  "completed",
  "denied",
  "refunded",
  "partially-refunded",
]);
export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;

/** Settled funds from an order capture; the anchor for refund bounds. */
export const CaptureSchema = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  promiseId: z.string().min(1),
  providerCaptureId: z.string().min(1),
  amount: NonNegativeMoneySchema,
  status: CaptureStatusSchema,
  capturedAt: z.iso.datetime(),
});
export type Capture = z.infer<typeof CaptureSchema>;
