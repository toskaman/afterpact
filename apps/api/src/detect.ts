import type {
  IncidentCategory,
  IncidentSeverity,
  PurchasePromise,
} from "../../../packages/domain/src/index";

/** Structured observation attached to an outcome event for detection. */
export interface Observation {
  deliveredQuantity?: number;
  deliveredAt?: string;
  chargedMinor?: number;
  status?: string;
  note?: string;
}

export interface DetectedGap {
  category: IncidentCategory;
  severity: IncidentSeverity;
  detail: string;
}

/**
 * Deterministic promise-vs-outcome comparison. Pure function: every gap it
 * reports cites the promised vs. observed values. Returns [] when the
 * observation is consistent with the promise (within tolerances).
 */
export function detectGaps(promise: PurchasePromise, obs: Observation): DetectedGap[] {
  const gaps: DetectedGap[] = [];
  const promisedQty = promise.items.reduce((n, item) => n + item.quantity, 0);

  if (obs.status === "not-delivered") {
    gaps.push({
      category: "not-delivered",
      severity: "high",
      detail: `Promised ${promisedQty} item(s) from ${promise.merchantId}; carrier reports not-delivered.`,
    });
    return gaps;
  }

  if (obs.deliveredQuantity !== undefined && obs.deliveredQuantity !== promisedQty) {
    const missing = promisedQty - obs.deliveredQuantity;
    gaps.push({
      category: missing > 0 ? "not-delivered" : "wrong-item",
      severity: missing > 0 ? "high" : "medium",
      detail:
        missing > 0
          ? `Short delivery: promised ${promisedQty} item(s), ${obs.deliveredQuantity} delivered (${missing} missing).`
          : `Over delivery: promised ${promisedQty} item(s), ${obs.deliveredQuantity} delivered.`,
    });
  }

  if (obs.deliveredAt !== undefined) {
    const promisedMs = Date.parse(promise.expectedDeliveryDate);
    const observedMs = Date.parse(obs.deliveredAt);
    const graceMs = promise.tolerances.maxDelayDays * 86_400_000;
    if (Number.isFinite(observedMs) && observedMs > promisedMs + graceMs) {
      const lateDays = Math.ceil((observedMs - promisedMs) / 86_400_000);
      gaps.push({
        category: "late-delivery",
        severity: lateDays > 7 ? "high" : "medium",
        detail: `Late delivery: promised by ${promise.expectedDeliveryDate.slice(0, 10)}, observed ${obs.deliveredAt.slice(0, 10)} (${lateDays} days late, tolerance ${promise.tolerances.maxDelayDays}d).`,
      });
    }
  }

  if (obs.chargedMinor !== undefined) {
    const driftBps = Math.round(
      (Math.abs(obs.chargedMinor - promise.total.amountMinor) / Math.max(1, promise.total.amountMinor)) * 10_000,
    );
    if (obs.chargedMinor > promise.total.amountMinor && driftBps > promise.tolerances.maxPriceDriftBps) {
      const over = obs.chargedMinor - promise.total.amountMinor;
      gaps.push({
        category: "overcharge",
        severity: driftBps > 1000 ? "high" : "medium",
        detail: `Overcharge: promised ${promise.total.amountMinor} minor (${promise.total.currency}), charged ${obs.chargedMinor} (+${over}, drift ${driftBps} bps vs tolerance ${promise.tolerances.maxPriceDriftBps} bps).`,
      });
    }
  }

  return gaps;
}
