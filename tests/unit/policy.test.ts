import { describe, expect, it } from "vitest";
import {
  attachApproval,
  createPromise,
  proposeChange,
  type PurchasePromise,
} from "../../packages/domain/src/index";
import {
  evaluate,
  evaluateRefund,
  type PolicyContext,
} from "../../packages/policy/src/index";
import { makeApproval, makePromiseInput } from "./promise.test";

const T0 = "2026-11-07T12:00:00.000Z";

function baseContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    now: T0,
    killSwitch: false,
    knownMerchants: { merchant_acme: { owner: "org_buyer" } },
    expectedOwner: "org_buyer",
    maxAmountMinor: 5000,
    ...overrides,
  };
}

function approvedPromise(): PurchasePromise {
  const v1 = createPromise(makePromiseInput());
  return attachApproval(v1, makeApproval(v1.id, v1.version, v1.hash));
}

describe("policy engine", () => {
  it("clears a within-budget promise from an owned merchant", () => {
    const decision = evaluate(approvedPromise(), baseContext());
    expect(decision).toEqual({ verdict: "Cleared", reasons: [] });
  });

  it("refuses when the kill switch is engaged", () => {
    const decision = evaluate(
      approvedPromise(),
      baseContext({ killSwitch: true }),
    );
    expect(decision).toEqual({
      verdict: "Refused",
      reasons: ["kill-switch-engaged"],
    });
  });

  it("refuses a tampered promise hash", () => {
    const tampered = {
      ...approvedPromise(),
      total: { currency: "USD", amountMinor: 1 },
    };
    expect(evaluate(tampered, baseContext())).toEqual({
      verdict: "Refused",
      reasons: ["promise-hash-mismatch"],
    });
  });

  it("holds when approval is missing", () => {
    expect(evaluate(createPromise(makePromiseInput()), baseContext())).toEqual(
      { verdict: "Hold", reasons: ["approval-missing"] },
    );
  });

  it("refuses a stale approval binding", () => {
    const v1 = createPromise(makePromiseInput());
    const stale = makeApproval(v1.id, v1.version, v1.hash);
    const v2 = proposeChange(v1, { validUntil: "2027-06-01T00:00:00.000Z" }, T0)
      .promise;
    // Approval is excluded from the integrity hash, so swapping in the stale
    // v1 approval keeps integrity green while binding must fail.
    const mismatched: PurchasePromise = { ...v2, approval: stale };
    expect(evaluate(mismatched, baseContext())).toEqual({
      verdict: "Refused",
      reasons: ["approval-binding-mismatch"],
    });
  });

  it("refuses an expired approval", () => {
    const v1 = createPromise(makePromiseInput());
    const expired = {
      ...makeApproval(v1.id, v1.version, v1.hash),
      expiresAt: "2026-01-01T00:00:00.000Z",
    };
    const promise = attachApproval(v1, expired);
    expect(evaluate(promise, baseContext())).toEqual({
      verdict: "Refused",
      reasons: ["approval-expired"],
    });
  });

  it("holds on unknown merchant, refuses blocked or mis-owned merchants", () => {
    expect(
      evaluate(approvedPromise(), baseContext({ knownMerchants: {} })),
    ).toEqual({ verdict: "Hold", reasons: ["merchant-unknown"] });
    expect(
      evaluate(
        approvedPromise(),
        baseContext({
          knownMerchants: {
            merchant_acme: { owner: "org_buyer", blocked: true },
          },
        }),
      ),
    ).toEqual({ verdict: "Refused", reasons: ["merchant-blocked"] });
    expect(
      evaluate(
        approvedPromise(),
        baseContext({
          knownMerchants: { merchant_acme: { owner: "org_stranger" } },
        }),
      ),
    ).toEqual({ verdict: "Refused", reasons: ["merchant-ownership-mismatch"] });
  });

  it("refuses an expired promise", () => {
    const v1 = createPromise(
      makePromiseInput({ validUntil: "2026-01-01T00:00:00.000Z" }),
    );
    const promise = attachApproval(
      v1,
      makeApproval(v1.id, v1.version, v1.hash),
    );
    expect(evaluate(promise, baseContext())).toEqual({
      verdict: "Refused",
      reasons: ["promise-expired"],
    });
  });

  it("refuses amounts over max and increases since approval", () => {
    expect(
      evaluate(approvedPromise(), baseContext({ maxAmountMinor: 100 })),
    ).toEqual({ verdict: "Refused", reasons: ["amount-exceeds-max"] });
    expect(
      evaluate(
        approvedPromise(),
        baseContext({
          previousApproved: { version: 1, totalMinor: 2000 },
        }),
      ),
    ).toEqual({
      verdict: "Refused",
      reasons: ["amount-increased-since-approval"],
    });
    // Same total as approved still clears.
    expect(
      evaluate(
        approvedPromise(),
        baseContext({
          previousApproved: { version: 1, totalMinor: 2500 },
        }),
      ),
    ).toEqual({ verdict: "Cleared", reasons: [] });
  });
});

describe("refund policy gate", () => {
  const captured = { currency: "USD", amountMinor: 2500 };

  it("clears a bounded refund", () => {
    expect(
      evaluateRefund({
        now: T0,
        killSwitch: false,
        captured,
        alreadyRefundedMinor: 500,
        requested: { currency: "USD", amountMinor: 2000 },
      }),
    ).toEqual({ verdict: "Cleared", reasons: [] });
  });

  it("refuses over-capture refunds and honors the kill switch", () => {
    expect(
      evaluateRefund({
        now: T0,
        killSwitch: false,
        captured,
        alreadyRefundedMinor: 500,
        requested: { currency: "USD", amountMinor: 2001 },
      }),
    ).toEqual({ verdict: "Refused", reasons: ["refund-exceeds-captured"] });
    expect(
      evaluateRefund({
        now: T0,
        killSwitch: true,
        captured,
        alreadyRefundedMinor: 0,
        requested: { currency: "USD", amountMinor: 100 },
      }),
    ).toEqual({ verdict: "Refused", reasons: ["kill-switch-engaged"] });
  });
});
