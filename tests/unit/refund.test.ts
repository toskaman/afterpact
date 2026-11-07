import { describe, expect, it } from "vitest";
import {
  RefundBoundsError,
  remainingRefundable,
  validateRefundBounds,
} from "../../packages/domain/src/index";

const CAPTURED = { currency: "USD", amountMinor: 2500 };

describe("refund bounds", () => {
  it("accepts full and partial refunds within the captured total", () => {
    expect(() =>
      validateRefundBounds({
        captured: CAPTURED,
        alreadyRefundedMinor: 0,
        requested: { currency: "USD", amountMinor: 2500 },
      }),
    ).not.toThrow();
    expect(() =>
      validateRefundBounds({
        captured: CAPTURED,
        alreadyRefundedMinor: 2000,
        requested: { currency: "USD", amountMinor: 500 },
      }),
    ).not.toThrow();
  });

  it("rejects refunds that exceed the captured total", () => {
    try {
      validateRefundBounds({
        captured: CAPTURED,
        alreadyRefundedMinor: 2000,
        requested: { currency: "USD", amountMinor: 501 },
      });
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RefundBoundsError);
      expect((error as RefundBoundsError).code).toBe("refund-exceeds-captured");
    }
  });

  it("rejects non-positive and cross-currency refunds", () => {
    for (const minor of [0, -100]) {
      try {
        validateRefundBounds({
          captured: CAPTURED,
          alreadyRefundedMinor: 0,
          requested: { currency: "USD", amountMinor: minor },
        });
        expect.unreachable("must throw");
      } catch (error) {
        expect((error as RefundBoundsError).code).toBe(
          "refund-amount-non-positive",
        );
      }
    }
    try {
      validateRefundBounds({
        captured: CAPTURED,
        alreadyRefundedMinor: 0,
        requested: { currency: "EUR", amountMinor: 100 },
      });
      expect.unreachable("must throw");
    } catch (error) {
      expect((error as RefundBoundsError).code).toBe("refund-currency-mismatch");
    }
  });

  it("computes remaining refundable exactly", () => {
    expect(remainingRefundable(CAPTURED, 500)).toEqual({
      currency: "USD",
      amountMinor: 2000,
    });
    expect(remainingRefundable(CAPTURED, 2500)).toEqual({
      currency: "USD",
      amountMinor: 0,
    });
  });
});
