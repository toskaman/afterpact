import {
  parseKey,
  type Capture,
  type Order,
  type PaymentOperation,
  type RefundOperation,
} from "../../domain/src/index";
import { PayPalConcurrencyError, PayPalReplayError } from "./errors";

/**
 * Async mutex: FIFO critical sections for transactional state updates.
 * Every mutating service method runs inside one of these, so concurrent
 * callers serialize and partial writes are impossible (validate first,
 * then mutate, all under the lock).
 */
export class PayPalMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(
    fn: () => Promise<T> | T,
    timeoutMs = 10_000,
  ): Promise<T> {
    const prior = this.tail;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tail = prior.then(() => gate);
    await prior;
    try {
      return await withTimeout(Promise.resolve().then(fn), timeoutMs);
    } finally {
      release();
    }
  }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new PayPalConcurrencyError(
          `payment critical section timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
    timer.unref?.();
  });
  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** One mutex per key (order, capture, webhook transmission, ...). */
export class KeyedMutex {
  private readonly locks = new Map<string, PayPalMutex>();

  runExclusive<T>(
    key: string,
    fn: () => Promise<T> | T,
    timeoutMs?: number,
  ): Promise<T> {
    let mutex = this.locks.get(key);
    if (mutex === undefined) {
      mutex = new PayPalMutex();
      this.locks.set(key, mutex);
    }
    return mutex.runExclusive(fn, timeoutMs);
  }
}

export interface StoredIdempotency {
  key: string;
  owner: string;
  /** Fingerprint of the normalized request payload for replay detection. */
  fingerprint: string;
  result: unknown;
  createdAt: string;
}

export interface StoredWebhookTransmission {
  transmissionId: string;
  eventId: string;
  eventType: string;
  bodyFingerprint: string;
  receivedAt: string;
}

/**
 * In-memory payment record store (single process). Production persistence
 * lands behind this same shape with unique constraints on idempotency keys
 * and webhook transmission ids.
 */
export class PaymentStore {
  readonly orders = new Map<string, Order>();
  readonly ordersByProviderId = new Map<string, string>();
  readonly operations = new Map<string, PaymentOperation>();
  readonly operationsByKey = new Map<string, string>();
  readonly captures = new Map<string, Capture>();
  readonly capturesByProviderId = new Map<string, string>();
  readonly refunds = new Map<string, RefundOperation>();
  readonly refundsByProviderId = new Map<string, string>();
  readonly idempotency = new Map<string, StoredIdempotency>();
  readonly webhookTransmissions = new Map<string, StoredWebhookTransmission>();
  readonly locks = new KeyedMutex();

  /**
   * Replay-safe idempotency check. Unknown keys return a miss; known keys
   * with the same payload fingerprint return the stored result; known keys
   * with a different fingerprint are replays and throw.
   */
  checkIdempotency<T>(
    key: string,
    fingerprint: string,
  ): { duplicate: boolean; result?: T } {
    const parsed = parseKey(key);
    const record = this.idempotency.get(parsed);
    if (record === undefined) return { duplicate: false };
    if (record.fingerprint !== fingerprint) {
      throw new PayPalReplayError(parsed);
    }
    return { duplicate: true, result: record.result as T };
  }

  recordIdempotency(
    key: string,
    owner: string,
    fingerprint: string,
    result: unknown,
    createdAt: string,
  ): void {
    const parsed = parseKey(key);
    this.idempotency.set(parsed, {
      key: parsed,
      owner,
      fingerprint,
      result,
      createdAt,
    });
  }

  putOrder(order: Order): void {
    this.orders.set(order.id, order);
    if (order.providerOrderId !== undefined) {
      this.ordersByProviderId.set(order.providerOrderId, order.id);
    }
  }

  putCapture(capture: Capture): void {
    this.captures.set(capture.id, capture);
    this.capturesByProviderId.set(capture.providerCaptureId, capture.id);
  }

  putRefund(refund: RefundOperation): void {
    this.refunds.set(refund.id, refund);
    if (refund.providerRefundId !== undefined) {
      this.refundsByProviderId.set(refund.providerRefundId, refund.id);
    }
  }

  putOperation(operation: PaymentOperation): void {
    this.operations.set(operation.id, operation);
    this.operationsByKey.set(operation.idempotencyKey, operation.id);
  }

  /** Sum of submitted + succeeded refunds against one capture, minor units. */
  refundedMinorForCapture(captureId: string): number {
    let total = 0;
    for (const refund of this.refunds.values()) {
      if (
        refund.captureId === captureId &&
        (refund.status === "submitted" || refund.status === "succeeded")
      ) {
        total += refund.amount.amountMinor;
      }
    }
    return total;
  }
}

