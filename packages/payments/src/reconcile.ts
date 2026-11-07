import { compare, type Money } from "../../domain/src/index";
import type { PaymentAuditLog } from "./auditLog";
import {
  PayPalInvalidStateError,
  PayPalNotFoundError,
} from "./errors";
import {
  mapProviderCaptureStatus,
  mapProviderOrderStatus,
  mapProviderRefundStatus,
} from "./status";
import type { PaymentStore } from "./store";
import type { PayPalTransport } from "./transport";

export interface ReconciliationDiff {
  field: string;
  local: string;
  provider: string;
}

export interface ReconciliationReport {
  scope: "order" | "refund";
  localId: string;
  providerId: string;
  /** True when local and provider agree on every compared field. */
  matches: boolean;
  diffs: ReconciliationDiff[];
  /** Local fields repaired toward the provider truth, by name. */
  repaired: string[];
  checkedAt: string;
}

export interface ReconcileDeps {
  transport: PayPalTransport;
  store: PaymentStore;
  audit?: PaymentAuditLog;
  now?: () => string;
}

function moneyText(amount: Money): string {
  return `${amount.currency} ${amount.amountMinor}`;
}

/**
 * Compare a local order against the provider and repair local drift.
 * Read-only toward the provider: repairs only ever move LOCAL records
 * toward provider truth, and only forward along the lifecycle
 * (created -> approved -> captured, or -> voided). Runs under the order
 * lock so it cannot interleave with a capture.
 */
export async function reconcileOrder(
  deps: ReconcileDeps,
  orderId: string,
): Promise<ReconciliationReport> {
  const now = deps.now ?? (() => new Date().toISOString());
  return deps.store.locks.runExclusive(`order:${orderId}`, async () => {
    const order = deps.store.orders.get(orderId);
    if (order === undefined) {
      throw new PayPalNotFoundError(`order ${orderId} not found`);
    }
    if (order.providerOrderId === undefined) {
      throw new PayPalInvalidStateError(
        `order ${orderId} has no provider order id yet`,
      );
    }
    const provider = await deps.transport.getOrder(order.providerOrderId);
    const diffs: ReconciliationDiff[] = [];
    const repaired: string[] = [];

    const providerStatus = mapProviderOrderStatus(provider.status);
    if (providerStatus !== order.status) {
      diffs.push({
        field: "status",
        local: order.status,
        provider: `${providerStatus} (provider ${provider.status})`,
      });
      if (isForwardMove(order.status, providerStatus)) {
        deps.store.putOrder({
          ...order,
          status: providerStatus,
          updatedAt: now(),
        });
        repaired.push("status");
      }
    }

    let currencyMismatch = false;
    try {
      if (compare(order.amount, provider.amount) !== 0) {
        diffs.push({
          field: "amount",
          local: moneyText(order.amount),
          provider: moneyText(provider.amount),
        });
      }
    } catch {
      currencyMismatch = true;
      diffs.push({
        field: "currency",
        local: order.amount.currency,
        provider: provider.amount.currency,
      });
    }

    const localCaptureIds = new Set(
      [...deps.store.captures.values()]
        .filter((c) => c.orderId === orderId)
        .map((c) => c.providerCaptureId),
    );
    for (const capture of provider.captures) {
      if (!localCaptureIds.has(capture.id)) {
        diffs.push({
          field: "capture",
          local: "missing",
          provider: `${capture.id} ${capture.status} ${moneyText(capture.amount)}`,
        });
      }
    }

    if (
      provider.approveUrl !== undefined &&
      order.approveUrl !== provider.approveUrl
    ) {
      diffs.push({
        field: "approveUrl",
        local: order.approveUrl ?? "missing",
        provider: provider.approveUrl,
      });
      deps.store.putOrder({
        ...(deps.store.orders.get(orderId) ?? order),
        approveUrl: provider.approveUrl,
        updatedAt: now(),
      });
      repaired.push("approveUrl");
    }

    const report: ReconciliationReport = {
      scope: "order",
      localId: orderId,
      providerId: provider.id,
      matches: diffs.length === 0,
      diffs,
      repaired,
      checkedAt: now(),
    };
    deps.audit?.record({
      type: "paypal.reconcile.order",
      promiseId: order.promiseId,
      level: currencyMismatch || diffs.length > 0 ? "warn" : "info",
      payload: {
        orderId,
        providerOrderId: provider.id,
        matches: report.matches,
        diffs,
        repaired,
      },
    });
    return report;
  });
}

/**
 * Compare a local refund against the provider and repair local drift.
 * Same forward-only rule: requested/submitted -> succeeded/failed.
 */
export async function reconcileRefund(
  deps: ReconcileDeps,
  refundId: string,
): Promise<ReconciliationReport> {
  const now = deps.now ?? (() => new Date().toISOString());
  return deps.store.locks.runExclusive(`refund:${refundId}`, async () => {
    const refund = deps.store.refunds.get(refundId);
    if (refund === undefined) {
      throw new PayPalNotFoundError(`refund ${refundId} not found`);
    }
    if (refund.providerRefundId === undefined) {
      throw new PayPalInvalidStateError(
        `refund ${refundId} has no provider refund id yet`,
      );
    }
    const provider = await deps.transport.getRefund(refund.providerRefundId);
    const diffs: ReconciliationDiff[] = [];
    const repaired: string[] = [];

    const providerStatus = mapProviderRefundStatus(provider.status);
    if (providerStatus !== refund.status) {
      diffs.push({
        field: "status",
        local: refund.status,
        provider: `${providerStatus} (provider ${provider.status})`,
      });
      if (
        (refund.status === "requested" || refund.status === "submitted") &&
        (providerStatus === "succeeded" || providerStatus === "failed")
      ) {
        deps.store.putRefund({
          ...refund,
          status: providerStatus,
          updatedAt: now(),
        });
        repaired.push("status");
      }
    }

    try {
      if (compare(refund.amount, provider.amount) !== 0) {
        diffs.push({
          field: "amount",
          local: moneyText(refund.amount),
          provider: moneyText(provider.amount),
        });
      }
    } catch {
      diffs.push({
        field: "currency",
        local: refund.amount.currency,
        provider: provider.amount.currency,
      });
    }

    const report: ReconciliationReport = {
      scope: "refund",
      localId: refundId,
      providerId: provider.id,
      matches: diffs.length === 0,
      diffs,
      repaired,
      checkedAt: now(),
    };
    deps.audit?.record({
      type: "paypal.reconcile.refund",
      promiseId: refund.promiseId,
      level: diffs.length > 0 ? "warn" : "info",
      payload: {
        refundId,
        providerRefundId: provider.id,
        matches: report.matches,
        diffs,
        repaired,
      },
    });
    return report;
  });
}

/**
 * Reconcile capture statuses for one order (used after refresh reads).
 * Returns the number of capture records repaired.
 */
export async function reconcileCaptures(
  deps: ReconcileDeps,
  orderId: string,
): Promise<number> {
  const now = deps.now ?? (() => new Date().toISOString());
  return deps.store.locks.runExclusive(`order:${orderId}`, async () => {
    const order = deps.store.orders.get(orderId);
    if (order?.providerOrderId === undefined) {
      throw new PayPalNotFoundError(`order ${orderId} not found`);
    }
    const provider = await deps.transport.getOrder(order.providerOrderId);
    let repaired = 0;
    for (const pc of provider.captures) {
      const localId = deps.store.capturesByProviderId.get(pc.id);
      if (localId === undefined) continue;
      const capture = deps.store.captures.get(localId);
      if (capture === undefined) continue;
      const mapped = mapProviderCaptureStatus(pc.status);
      if (mapped !== capture.status) {
        deps.store.putCapture({ ...capture, status: mapped });
        repaired += 1;
      }
    }
    void now;
    return repaired;
  });
}

/** Forward-only lifecycle moves the reconciler may apply locally. */
function isForwardMove(from: string, to: string): boolean {
  if (from === to) return false;
  if (to === "voided" || to === "failed") {
    return from === "created" || from === "approved";
  }
  if (from === "created" && (to === "approved" || to === "captured")) {
    return true;
  }
  return from === "approved" && to === "captured";
}

