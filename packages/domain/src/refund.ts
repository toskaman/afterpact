import { z } from "zod";
import { NonNegativeMoneySchema, subtract, type Money } from "./money";
import { IdempotencyKeySchema } from "./idempotency";

export class RefundBoundsError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "refund-amount-non-positive"
      | "refund-currency-mismatch"
      | "refund-exceeds-captured",
  ) {
    super(message);
    this.name = "RefundBoundsError";
  }
}

export const RefundStatusSchema = z.enum([
  "requested",
  "submitted",
  "succeeded",
  "failed",
]);
export type RefundStatus = z.infer<typeof RefundStatusSchema>;

/** Our record of a capture refund (full when amount == captured total). */
export const RefundOperationSchema = z.object({
  id: z.string().min(1),
  captureId: z.string().min(1),
  promiseId: z.string().min(1),
  amount: NonNegativeMoneySchema,
  reason: z.string().min(1).max(2000),
  idempotencyKey: IdempotencyKeySchema,
  status: RefundStatusSchema,
  providerRefundId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RefundOperation = z.infer<typeof RefundOperationSchema>;

/** Funds still refundable: captured minus already-refunded (same currency). */
export function remainingRefundable(
  captured: Money,
  alreadyRefundedMinor: number,
): Money {
  return subtract(captured, {
    currency: captured.currency,
    amountMinor: alreadyRefundedMinor,
  });
}

export interface RefundBoundsInput {
  captured: Money;
  /** Sum of prior succeeded/submitted refunds, in minor units. */
  alreadyRefundedMinor: number;
  requested: Money;
}

/**
 * Enforce refund bounds: positive amount, same currency, and lifetime
 * refunds never exceed the captured total. Throws RefundBoundsError.
 */
export function validateRefundBounds(input: RefundBoundsInput): void {
  const { captured, alreadyRefundedMinor, requested } = input;
  if (requested.amountMinor <= 0) {
    throw new RefundBoundsError(
      `refund amount must be positive, got ${requested.amountMinor}`,
      "refund-amount-non-positive",
    );
  }
  if (requested.currency !== captured.currency) {
    throw new RefundBoundsError(
      `refund currency ${requested.currency} must match captured ${captured.currency}`,
      "refund-currency-mismatch",
    );
  }
  if (!Number.isSafeInteger(alreadyRefundedMinor) || alreadyRefundedMinor < 0) {
    throw new RefundBoundsError(
      `already-refunded must be a non-negative safe integer, got ${alreadyRefundedMinor}`,
      "refund-amount-non-positive",
    );
  }
  if (alreadyRefundedMinor + requested.amountMinor > captured.amountMinor) {
    throw new RefundBoundsError(
      `refund of ${requested.amountMinor} exceeds remaining ${captured.amountMinor - alreadyRefundedMinor} of captured ${captured.amountMinor}`,
      "refund-exceeds-captured",
    );
  }
}
