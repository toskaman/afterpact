import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendEvent,
  findChainBreak,
  verifyChain,
  type AuditEvent,
  type Evidence,
  type Incident,
  type LifecycleState,
  type NewAuditEventInput,
  type Offer,
  type Order,
  type Capture,
  type PaymentOperation,
  type PurchaseIntent,
  type PurchasePromise,
  type RefundOperation,
  type ResolutionApproval,
  type ResolutionProposal,
  type OutcomeEvent,
} from "../../../packages/domain/src/index";

/** One promise plus its operational lifecycle and relation index. */
export interface PromiseRecord {
  promise: PurchasePromise;
  state: LifecycleState;
  /** Last approved {version,total} — feeds the amount-increase policy rule. */
  lastApproved?: { version: number; totalMinor: number };
  orderIds: string[];
  outcomeIds: string[];
  incidentIds: string[];
}

export interface DemoRun {
  id: string;
  scenario: "flagship" | "injection";
  label: string;
  status: "running" | "awaiting-action" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  transport: string;
  acts: DemoActResult[];
  context: Record<string, string>;
  needsAction?: {
    kind: "buyer-approval";
    orderId: string;
    approveUrl: string;
  };
  error?: string;
}

export interface DemoActResult {
  act: number;
  title: string;
  status: "passed" | "blocked" | "awaiting" | "failed" | "skipped";
  detail: string;
  /** Honest provenance marker for every demo step. */
  origin: "real-api" | "paypal-sandbox-live" | "mock-simulated" | "simulated-logistics" | "heuristic-parse" | "not-in-build";
  refIds: Record<string, string>;
}

export interface Snapshot {
  version: 1;
  intents: PurchaseIntent[];
  offers: Offer[];
  promises: PromiseRecord[];
  outcomes: OutcomeEvent[];
  evidence: Evidence[];
  incidents: Incident[];
  proposals: ResolutionProposal[];
  resolutionApprovals: ResolutionApproval[];
  appAudit: AuditEvent[];
  orders: Order[];
  captures: Capture[];
  refunds: RefundOperation[];
  operations: PaymentOperation[];
  idempotency: { key: string; owner: string; fingerprint: string; result: unknown; createdAt: string }[];
  demoRuns: DemoRun[];
}

function emptySnapshot(): Snapshot {
  return {
    version: 1,
    intents: [],
    offers: [],
    promises: [],
    outcomes: [],
    evidence: [],
    incidents: [],
    proposals: [],
    resolutionApprovals: [],
    appAudit: [],
    orders: [],
    captures: [],
    refunds: [],
    operations: [],
    idempotency: [],
    demoRuns: [],
  };
}

/**
 * File-backed application store. JSON snapshot persistence (atomic write via
 * tmp + rename). Pass `:memory:` to disable persistence (tests, ephemeral).
 */
export class AppStore {
  readonly intents = new Map<string, PurchaseIntent>();
  readonly offers = new Map<string, Offer>();
  readonly promises = new Map<string, PromiseRecord>();
  readonly outcomes = new Map<string, OutcomeEvent>();
  readonly evidence = new Map<string, Evidence>();
  readonly incidents = new Map<string, Incident>();
  readonly proposals = new Map<string, ResolutionProposal>();
  readonly resolutionApprovals = new Map<string, ResolutionApproval>();
  readonly demoRuns = new Map<string, DemoRun>();
  private chain: AuditEvent[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly filePath: string | null) {
    if (filePath !== null && existsSync(filePath)) {
      try {
        this.load(readFileSync(filePath, "utf8"));
      } catch (primary) {
        const backup = `${filePath}.bak`;
        if (!existsSync(backup)) throw primary;
        this.load(readFileSync(backup, "utf8"));
      }
    }
  }

  static resolveFilePath(dataDir: string | undefined): string | null {
    if (dataDir === ":memory:") return null;
    const dir = dataDir ?? join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    return join(dir, "afterpact.json");
  }

  private load(raw: string): void {
    const snap = JSON.parse(raw) as Snapshot;
    if (snap.version !== 1) throw new Error("unsupported snapshot version");
    const arrays = [
      snap.intents, snap.offers, snap.promises, snap.outcomes, snap.evidence,
      snap.incidents, snap.proposals, snap.resolutionApprovals, snap.appAudit,
      snap.orders, snap.captures, snap.refunds, snap.operations,
      snap.idempotency, snap.demoRuns,
    ];
    if (arrays.some((a) => !Array.isArray(a))) {
      throw new Error("invalid snapshot shape: expected array collections");
    }
    for (const v of snap.intents) this.intents.set(v.id, v);
    for (const v of snap.offers) this.offers.set(v.id, v);
    for (const v of snap.promises) this.promises.set(v.promise.id, v);
    for (const v of snap.outcomes) this.outcomes.set(v.id, v);
    for (const v of snap.evidence) this.evidence.set(v.id, v);
    for (const v of snap.incidents) this.incidents.set(v.id, v);
    for (const v of snap.proposals) this.proposals.set(v.id, v);
    for (const v of snap.resolutionApprovals) this.resolutionApprovals.set(v.id, v);
    for (const v of snap.demoRuns) this.demoRuns.set(v.id, v);
    this.chain = snap.appAudit;
    const broken = findChainBreak(this.chain);
    if (broken !== -1) {
      throw new Error(`persisted audit chain is broken at seq ${broken}`);
    }
  }

  snapshot(payment: {
    orders: Order[];
    captures: Capture[];
    refunds: RefundOperation[];
    operations: PaymentOperation[];
    idempotency: Snapshot["idempotency"];
  }): Snapshot {
    return {
      version: 1,
      intents: [...this.intents.values()],
      offers: [...this.offers.values()],
      promises: [...this.promises.values()],
      outcomes: [...this.outcomes.values()],
      evidence: [...this.evidence.values()],
      incidents: [...this.incidents.values()],
      proposals: [...this.proposals.values()],
      resolutionApprovals: [...this.resolutionApprovals.values()],
      appAudit: this.chain,
      orders: payment.orders,
      captures: payment.captures,
      refunds: payment.refunds,
      operations: payment.operations,
      idempotency: payment.idempotency,
      demoRuns: [...this.demoRuns.values()],
    };
  }

  /** Debounced durable write; call flush() on graceful shutdown. */
  save(
    payment: {
      orders: Order[];
      captures: Capture[];
      refunds: RefundOperation[];
      operations: PaymentOperation[];
      idempotency: Snapshot["idempotency"];
    },
  ): void {
    if (this.filePath === null) return;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.writeNow(payment);
    }, 50);
    this.saveTimer.unref?.();
  }

  writeNow(payment: {
    orders: Order[];
    captures: Capture[];
    refunds: RefundOperation[];
    operations: PaymentOperation[];
    idempotency: Snapshot["idempotency"];
  }): void {
    if (this.filePath === null) return;
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.snapshot(payment)));
    if (existsSync(this.filePath)) copyFileSync(this.filePath, `${this.filePath}.bak`);
    renameSync(tmp, this.filePath);
  }

  /** Append one Flight Recorder entry (hash-chained, append-only). */
  record(input: NewAuditEventInput): AuditEvent {
    const event = appendEvent(this.chain, input);
    this.chain = [...this.chain, event];
    return event;
  }

  get audit(): readonly AuditEvent[] {
    return this.chain;
  }

  verifyAudit(): boolean {
    return verifyChain(this.chain);
  }

  auditFor(promiseId: string): AuditEvent[] {
    return this.chain.filter((e) => e.promiseId === promiseId);
  }

  clearAll(): void {
    this.intents.clear();
    this.offers.clear();
    this.promises.clear();
    this.outcomes.clear();
    this.evidence.clear();
    this.incidents.clear();
    this.proposals.clear();
    this.resolutionApprovals.clear();
    this.demoRuns.clear();
    this.chain = [];
  }
}
