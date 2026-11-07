import {
  isApprovalExpired,
  isPromiseExpired,
  validateRefundBounds,
  verifyIntegrity,
  type Money,
  type PurchasePromise,
} from "../../domain/src/index";

export type Verdict = "Cleared" | "Hold" | "Refused";

export interface PolicyDecision {
  verdict: Verdict;
  /** Machine-readable reason codes, most severe first. */
  reasons: string[];
}

export interface KnownMerchant {
  /** Org that owns / vouched for this merchant. */
  owner: string;
  blocked?: boolean;
}

export interface PolicyContext {
  /** ISO now used for every time check in one evaluation. */
  now: string;
  /** Global kill switch: when true, every payment-affecting check refuses. */
  killSwitch: boolean;
  knownMerchants: Record<string, KnownMerchant>;
  /** Expected merchant owner; set when the buyer org pins its suppliers. */
  expectedOwner?: string;
  /** Hard ceiling for the promise total, in minor units. */
  maxAmountMinor?: number;
  /** Last approved total; increases since approval are refused. */
  previousApproved?: { version: number; totalMinor: number };
}

export interface RefundPolicyContext {
  now: string;
  killSwitch: boolean;
  captured: Money;
  alreadyRefundedMinor: number;
  requested: Money;
}

/**
 * Deterministic, pure policy evaluation. No I/O, integer cents only.
 * Rule order is severity-first: kill switch, integrity, approval, merchant,
 * expiry, amount. First Refused short-circuits; Holds accumulate.
 */
export function evaluate(
  promise: PurchasePromise,
  context: PolicyContext,
): PolicyDecision {
  if (context.killSwitch) {
    return { verdict: "Refused", reasons: ["kill-switch-engaged"] };
  }

  if (!verifyIntegrity(promise)) {
    return { verdict: "Refused", reasons: ["promise-hash-mismatch"] };
  }

  const approval = promise.approval;
  if (approval === null) {
    return { verdict: "Hold", reasons: ["approval-missing"] };
  }
  if (
    approval.promiseId !== promise.id ||
    approval.promiseVersion !== promise.version ||
    approval.promiseHash !== promise.hash
  ) {
    return { verdict: "Refused", reasons: ["approval-binding-mismatch"] };
  }
  if (isApprovalExpired(approval, context.now)) {
    return { verdict: "Refused", reasons: ["approval-expired"] };
  }

  const merchant = context.knownMerchants[promise.merchantId];
  if (merchant === undefined) {
    return { verdict: "Hold", reasons: ["merchant-unknown"] };
  }
  if (merchant.blocked === true) {
    return { verdict: "Refused", reasons: ["merchant-blocked"] };
  }
  if (
    context.expectedOwner !== undefined &&
    merchant.owner !== context.expectedOwner
  ) {
    return { verdict: "Refused", reasons: ["merchant-ownership-mismatch"] };
  }

  if (isPromiseExpired(promise, context.now)) {
    return { verdict: "Refused", reasons: ["promise-expired"] };
  }

  if (
    context.maxAmountMinor !== undefined &&
    promise.total.amountMinor > context.maxAmountMinor
  ) {
    return { verdict: "Refused", reasons: ["amount-exceeds-max"] };
  }

  if (
    context.previousApproved !== undefined &&
    promise.total.amountMinor > context.previousApproved.totalMinor
  ) {
    return { verdict: "Refused", reasons: ["amount-increased-since-approval"] };
  }

  return { verdict: "Cleared", reasons: [] };
}

/** Refund gate: kill switch first, then exact domain refund bounds. */
export function evaluateRefund(context: RefundPolicyContext): PolicyDecision {
  if (context.killSwitch) {
    return { verdict: "Refused", reasons: ["kill-switch-engaged"] };
  }
  try {
    validateRefundBounds({
      captured: context.captured,
      alreadyRefundedMinor: context.alreadyRefundedMinor,
      requested: context.requested,
    });
  } catch (error: unknown) {
    const code =
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "refund-rejected";
    return { verdict: "Refused", reasons: [code] };
  }
  return { verdict: "Cleared", reasons: [] };
}
