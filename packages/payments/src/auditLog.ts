import {
  appendEvent,
  verifyChain,
  type AuditEvent,
  type NewAuditEventInput,
} from "../../domain/src/index";
import { redactValue } from "./redact";

export type AuditLogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogEntry {
  level: AuditLogLevel;
  message: string;
  seq: number;
  hash: string;
  promiseId?: string;
  actor?: string;
  payload: Record<string, unknown>;
  recordedAt: string;
}

export type StructuredLogSink = (entry: StructuredLogEntry) => void;

export interface RecordPaymentEventInput {
  type: string;
  promiseId?: string;
  actor?: string;
  level?: AuditLogLevel;
  payload?: Record<string, unknown>;
}

/**
 * Structured, secret-free audit log. Every payment state change appends one
 * hash-chained Flight Recorder entry (domain audit chain) and emits one
 * structured log line. Payloads are redacted before either sink, so secrets
 * can never reach logs or the audit trail — by construction, not by review.
 */
export class PaymentAuditLog {
  private chain: AuditEvent[] = [];

  constructor(
    private readonly sink?: StructuredLogSink,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  record(input: RecordPaymentEventInput): AuditEvent {
    const payload = redactValue(input.payload ?? {}) as Record<string, unknown>;
    const auditInput: NewAuditEventInput = {
      type: input.type,
      payload,
      recordedAt: this.now(),
      ...(input.promiseId === undefined
        ? {}
        : { promiseId: input.promiseId }),
      ...(input.actor === undefined ? {} : { actor: input.actor }),
    };
    const event = appendEvent(this.chain, auditInput);
    this.chain = [...this.chain, event];
    this.sink?.({
      level: input.level ?? "info",
      message: input.type,
      seq: event.seq,
      hash: event.hash,
      promiseId: event.promiseId,
      actor: event.actor,
      payload,
      recordedAt: event.recordedAt,
    });
    return event;
  }

  get entries(): readonly AuditEvent[] {
    return this.chain;
  }

  verify(): boolean {
    return verifyChain(this.chain);
  }
}

