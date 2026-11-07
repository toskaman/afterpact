import type {
  CaptureStatus,
  OrderStatus,
  RefundStatus,
} from "../../domain/src/index";
import { PayPalInvalidStateError } from "./errors";

/** PayPal Orders v2 status -> local order status. Fails loudly on drift. */
export function mapProviderOrderStatus(providerStatus: string): OrderStatus {
  switch (providerStatus) {
    case "CREATED":
    case "SAVED":
    case "PAYER_ACTION_REQUIRED":
      return "created";
    case "APPROVED":
      return "approved";
    case "COMPLETED":
      return "captured";
    case "VOIDED":
      return "voided";
    default:
      throw new PayPalInvalidStateError(
        `unknown provider order status: ${providerStatus}`,
      );
  }
}

/** PayPal capture status -> local capture status. Fails loudly on drift. */
export function mapProviderCaptureStatus(
  providerStatus: string,
): CaptureStatus {
  switch (providerStatus) {
    case "PENDING":
      return "pending";
    case "COMPLETED":
      return "completed";
    case "DECLINED":
    case "DENIED":
      return "denied";
    case "PARTIALLY_REFUNDED":
      return "partially-refunded";
    case "REFUNDED":
      return "refunded";
    default:
      throw new PayPalInvalidStateError(
        `unknown provider capture status: ${providerStatus}`,
      );
  }
}

/** PayPal refund status -> local refund status. Fails loudly on drift. */
export function mapProviderRefundStatus(providerStatus: string): RefundStatus {
  switch (providerStatus) {
    case "COMPLETED":
      return "succeeded";
    case "PENDING":
      return "submitted";
    case "FAILED":
    case "DENIED":
    case "CANCELLED":
      return "failed";
    default:
      throw new PayPalInvalidStateError(
        `unknown provider refund status: ${providerStatus}`,
      );
  }
}

