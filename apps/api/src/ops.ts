import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import {
  ApprovalSchema,
  assertApprovalUsable,
  attachApproval,
  createPromise,
  CurrencyCodeSchema,
  EvidenceSchema,
  fingerprintOf,
  IncidentDetectedBySchema,
  IncidentSchema,
  isOfferExpired,
  NonNegativeMoneySchema,
  OfferItemSchema,
  OutcomeEventSchema,
  OutcomeKindSchema,
  proposeChange,
  ProvenanceSchema,
  PurchaseIntentSchema,
  ResolutionApprovalSchema,
  ResolutionKindSchema,
  ResolutionProposalSchema,
  RiskToleranceSchema,
  transition,
  validateRefundBounds,
  type Approval,
  type Incident,
  type IncidentCategory,
  type LifecycleState,
  type Money,
  type Offer,
  type Order,
  type OutcomeEvent,
  type PromisePatch,
  type PurchaseIntent,
  type PurchasePromise,
  type ResolutionKind,
} from "../../../packages/domain/src/index";
import {
  evaluate,
  type PolicyContext,
} from "../../../packages/policy/src/index";
import { redactValue } from "../../../packages/payments/src/index";
import { AppStore, type DemoActResult, type Snapshot } from "./store";
import {
  Channel3Client,
  Channel3Error,
  Channel3NotConfiguredError,
  channel3ConfigFromEnv,
  DiscoveryCompareSchema,
  DiscoveryLookupSchema,
  DiscoverySearchSchema,
  type Channel3Status,
} from "./channel3";
import {
  applyStudioCommand,
  buildStudioDatasets,
  parseStudioCommand,
  StudioCommandError,
  type StudioCommandResult,
  type StudioDatasets,
} from "./studio";
import { buildTimeline, type RecoveryTimeline } from "./timeline";
import { DEMO_MERCHANTS, flagshipOffer, offersForIntent } from "./catalog";
import { detectGaps, type Observation } from "./detect";
import { parseIntentText, scanInjection } from "./nlparse";
import { wirePayments, type PayPalWiring, type TransportKind } from "./paypal";
import {
  analyzeIncidentForPromise,
  analyzeIntentText,
  planRecoveryForIncident,
  wireAIService,
} from "./aiTasks";
import type { AIService, CostLedgerSummary } from "../../../packages/ai/src/index";

/** HTTP-mapped application error. Routes render {error:{code,message,details}}. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Channel3NotConfiguredError) {
    return new HttpError(503, "discovery-unavailable", error.message);
  }
  if (error instanceof Channel3Error) {
    return new HttpError(502, "discovery-error", error.message, {
      code: error.code,
      status: error.status ?? null,
      retryable: error.retryable,
    });
  }
  if (error instanceof StudioCommandError) {
    return new HttpError(422, "studio-command", error.message, {
      hint: error.hint,
      understood: error.understood,
    });
  }
  if (error instanceof z.ZodError) {
    return new HttpError(422, "validation-error", "request failed validation", error.issues);
  }
  if (error instanceof Error) {
    switch (error.name) {
      case "InvalidTransitionError":
        return new HttpError(409, "invalid-transition", error.message);
      case "InvalidIdempotencyKeyError":
        return new HttpError(422, "bad-idempotency-key", error.message);
      case "ApprovalBindingError":
        return new HttpError(409, "approval-binding", error.message);
      case "ApprovalExpiredError":
        return new HttpError(409, "approval-expired", error.message);
      case "RefundBoundsError":
        return new HttpError(422, "refund-bounds", error.message);
      case "CurrencyMismatchError":
      case "InvalidMoneyError":
        return new HttpError(422, "money-error", error.message);
      case "PayPalReplayError":
      case "PayPalWebhookReplayError":
        return new HttpError(409, "replay-refused", error.message);
      case "PayPalKillSwitchError":
        return new HttpError(403, "kill-switch", error.message);
      case "PayPalInvalidStateError":
        return new HttpError(409, "payment-state", error.message);
      case "PayPalNotFoundError":
        return new HttpError(404, "payment-not-found", error.message);
      case "PayPalWebhookVerificationError":
        return new HttpError(401, "webhook-unverified", error.message);
      case "PayPalProviderError":
        return new HttpError(502, "provider-error", error.message);
      case "PayPalLiveDisabledError":
        return new HttpError(403, "live-disabled", error.message);
      case "PayPalConfigError":
        return new HttpError(500, "payment-config", error.message);
      case "PayPalError":
      case "PayPalConcurrencyError":
        return new HttpError(409, "payment-error", error.message);
      default:
        break;
    }
  }
  return new HttpError(500, "internal", "unexpected server error");
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const CreateIntentSchema = z.object({
  rawText: z.string().min(1).max(4000),
  buyerId: z.string().min(1).max(200).default("buyer-demo"),
  budgetMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  currency: CurrencyCodeSchema.optional(),
  categories: z.array(z.string().min(1).max(100)).max(20).optional(),
  quantity: z.number().int().positive().max(999).optional(),
  deadline: z.iso.datetime().optional(),
  riskTolerance: RiskToleranceSchema.optional(),
  mandatory: z.array(z.string().min(1).max(200)).max(50).optional(),
});
export type CreateIntentInput = z.infer<typeof CreateIntentSchema>;

export const CreatePromiseSchema = z.object({
  intentId: z.string().min(1),
  offerId: z.string().min(1),
  buyerId: z.string().min(1).max(200).optional(),
  validDays: z.number().int().min(1).max(90).default(14),
  maxDelayDays: z.number().int().min(0).max(365).default(2),
  maxPriceDriftBps: z.number().int().min(0).max(10000).default(100),
  autoRefundOnMiss: z.boolean().default(false),
  requireBuyerApproval: z.boolean().default(true),
  evidenceRequirements: z.array(z.string().min(1).max(200)).max(50).default([]),
});
export type CreatePromiseInput = z.infer<typeof CreatePromiseSchema>;

export const ApprovePromiseSchema = z.object({
  approvedBy: z.string().min(1).max(200),
  note: z.string().max(1000).optional(),
  expiresHours: z.number().int().min(1).max(24 * 90).default(72),
});
export type ApprovePromiseInput = z.infer<typeof ApprovePromiseSchema>;

export const ChangePromiseSchema = z.object({
  merchantId: z.string().min(1).max(200).optional(),
  total: NonNegativeMoneySchema.optional(),
  items: z.array(OfferItemSchema).min(1).max(100).optional(),
  expectedDeliveryDate: z.iso.datetime().optional(),
  validUntil: z.iso.datetime().optional(),
  reason: z.string().max(1000).optional(),
});
export type ChangePromiseInput = z.infer<typeof ChangePromiseSchema>;

export const CreateOrderSchema = z.object({
  promiseId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(160).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const RecordOutcomeSchema = z.object({
  promiseId: z.string().min(1),
  kind: OutcomeKindSchema,
  summary: z.string().min(1).max(2000),
  observedAt: z.iso.datetime().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  provenance: ProvenanceSchema,
  confidence: z.number().min(0).max(1),
});
export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;

export const ReportIncidentSchema = z.object({
  promiseId: z.string().min(1),
  category: z.enum(["late-delivery", "not-delivered", "wrong-item", "overcharge", "quality", "other"]),
  detail: z.string().min(1).max(4000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});
export type ReportIncidentInput = z.infer<typeof ReportIncidentSchema>;

export const ProposeResolutionSchema = z.object({
  incidentId: z.string().min(1),
  kind: ResolutionKindSchema,
  amount: NonNegativeMoneySchema.optional(),
  rationale: z.string().min(1).max(4000),
  proposedBy: z.string().min(1).max(200),
});
export type ProposeResolutionInput = z.infer<typeof ProposeResolutionSchema>;

export const DecideResolutionSchema = z.object({
  decidedBy: z.string().min(1).max(200),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(1000).optional(),
});
export type DecideResolutionInput = z.infer<typeof DecideResolutionSchema>;

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

export interface OpsOptions {
  dataDir?: string;
  clock?: () => string;
  processEnv?: NodeJS.ProcessEnv;
}

export interface PromiseView {
  promise: PurchasePromise;
  state: LifecycleState;
  policy: { verdict: string; reasons: string[]; context: Record<string, unknown> };
  orderIds: string[];
  outcomeIds: string[];
  incidentIds: string[];
}

const OPS_VERSION = "0.1.0";

export class Ops {
  wiring: PayPalWiring;
  readonly store: AppStore;
  private readonly clock: () => string;
  private readonly env: NodeJS.ProcessEnv;
  private killSwitchEngaged: boolean;
  private channel3: Channel3Client;
  private ai: AIService;

  constructor(options: OpsOptions = {}) {
    this.env = options.processEnv ?? process.env;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.store = new AppStore(AppStore.resolveFilePath(options.dataDir ?? this.env["AFTERPACT_DATA_DIR"]));
    this.wiring = wirePayments(this.env);
    this.killSwitchEngaged = this.wiring.env.config.killSwitch;
    this.channel3 = new Channel3Client(channel3ConfigFromEnv(this.env).config);
    this.ai = wireAIService(this.env);
    this.restorePayments();
  }

  /** Restore persisted payment records into the in-memory payment store. */
  private restorePayments(): void {
    const file = this.store.filePath;
    if (file === null || !existsSync(file)) return;
    const snap = JSON.parse(readFileSync(file, "utf8")) as Snapshot;
    if (snap.version !== 1) return;
    const store = this.wiring.store;
    for (const order of snap.orders ?? []) store.putOrder(order);
    for (const capture of snap.captures ?? []) store.putCapture(capture);
    for (const refund of snap.refunds ?? []) store.putRefund(refund);
    for (const op of snap.operations ?? []) store.putOperation(op);
    for (const entry of snap.idempotency ?? []) {
      store.recordIdempotency(entry.key, entry.owner, entry.fingerprint, entry.result, entry.createdAt);
    }
  }

  /** Replace payment wiring with a fresh instance (demo reset). */
  resetAll(): { cleared: Record<string, number> } {
    if (!this.resetAllowed()) {
      throw new HttpError(403, "reset-refused", "demo reset is only available in mock-simulated mode with AFTERPACT_ALLOW_DEMO_RESET != 0");
    }
    const cleared = {
      intents: this.store.intents.size,
      offers: this.store.offers.size,
      promises: this.store.promises.size,
      outcomes: this.store.outcomes.size,
      incidents: this.store.incidents.size,
      proposals: this.store.proposals.size,
      auditEntries: this.store.audit.length,
      orders: this.wiring.store.orders.size,
      captures: this.wiring.store.captures.size,
      refunds: this.wiring.store.refunds.size,
      demoRuns: this.store.demoRuns.size,
    };
    this.store.clearAll();
    this.wiring = wirePayments(this.env);
    this.killSwitchEngaged = this.wiring.env.config.killSwitch;
    this.record({ type: "demo.reset", actor: "demo-operator", payload: { cleared, transport: this.wiring.kind } });
    this.persist();
    return { cleared };
  }

  get transport(): TransportKind {
    return this.wiring.kind;
  }

  now(): string {
    return this.clock();
  }

  resetAllowed(): boolean {
    return this.wiring.kind === "mock-simulated" && this.env["AFTERPACT_ALLOW_DEMO_RESET"] !== "0";
  }

  maxAmountMinor(): number {
    const raw = this.env["AFTERPACT_MAX_AMOUNT_MINOR"];
    if (raw === undefined || raw.trim() === "") return 100_000; // $1,000.00 default ceiling
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new HttpError(500, "config", "AFTERPACT_MAX_AMOUNT_MINOR must be a positive integer");
    }
    return parsed;
  }

  // -- health / config -------------------------------------------------------

  health(): Record<string, unknown> {
    return {
      status: "ok",
      version: OPS_VERSION,
      time: this.now(),
      transport: this.wiring.kind,
      paypalMode: this.wiring.env.config.mode,
      paypalApiBase: this.wiring.env.config.apiBase,
      killSwitch: this.killSwitchEngaged,
      auditChainValid: this.store.verifyAudit(),
      auditEntries: this.store.audit.length,
      resetAllowed: this.resetAllowed(),
    };
  }

  config(): Record<string, unknown> {
    return {
      transport: this.wiring.kind,
      paypal: {
        mode: this.wiring.env.config.mode,
        apiBase: this.wiring.env.config.apiBase,
        clientIdPresent: this.wiring.env.credentials.clientId !== "",
        clientSecretPresent: this.wiring.env.credentials.clientSecret !== "",
        webhookIdPresent: (this.wiring.env.config.webhookId ?? "") !== "",
        allowLive: this.wiring.env.config.allowLive,
        requestTimeoutMs: this.wiring.env.config.requestTimeoutMs,
      },
      policy: { maxAmountMinor: this.maxAmountMinor() },
      features: {
        catalog: "simulated-catalog",
        logistics: "simulated-logistics",
        nlParse: "heuristic-parse",
        // Honest sponsor labels: AG Grid Community tables (NOT AG Studio),
        // Channel3 live only when a key is configured, Bryntum fallback.
        agStudio: "ag-grid-community",
        channel3: this.channel3.status.configured ? "live" : "unconfigured",
        bryntum: "fallback-timeline",
      },
      resetAllowed: this.resetAllowed(),
    };
  }

  setKillSwitch(engaged: boolean, actor: string): { killSwitch: boolean } {
    if (this.wiring.kind !== "mock-simulated") {
      throw new HttpError(403, "admin-refused", "kill-switch control is only exposed in mock-simulated mode");
    }
    this.killSwitchEngaged = engaged;
    this.wiring.service.setKillSwitch(engaged, actor);
    this.record({ type: "ops.killswitch.changed", actor, payload: { engaged } });
    this.persist();
    return { killSwitch: engaged };
  }

  // -- intents ---------------------------------------------------------------

  createIntent(raw: unknown): { intent: PurchaseIntent; parsed: Record<string, unknown>; transport: string } {
    const input = CreateIntentSchema.parse(raw);
    const now = this.now();
    const parsed = parseIntentText(input.rawText, Date.parse(now));
    const budgetMinor = input.budgetMinor ?? parsed.budgetMinor;
    if (budgetMinor === null || budgetMinor === undefined) {
      throw new HttpError(422, "budget-required", "no budget detected in text; supply budgetMinor explicitly", { notes: parsed.notes });
    }
    const currency = input.currency ?? parsed.currency;
    const deadline = input.deadline ?? new Date(Date.parse(now) + parsed.deadlineDays * 86_400_000).toISOString();
    const intent = PurchaseIntentSchema.parse({
      id: randomUUID(),
      buyerId: input.buyerId,
      rawText: input.rawText,
      budget: { currency, amountMinor: budgetMinor },
      categories: input.categories ?? parsed.categories,
      quantity: input.quantity ?? parsed.quantity,
      deadline,
      merchantConstraints: { allow: parsed.allowMerchants, deny: parsed.denyMerchants },
      riskTolerance: input.riskTolerance ?? "standard",
      mandatory: input.mandatory ?? parsed.mandatory,
      createdAt: now,
    });
    this.store.intents.set(intent.id, intent);
    const scan = scanInjection(input.rawText);
    this.record({
      type: "intent.created",
      actor: intent.buyerId,
      payload: { intentId: intent.id, origin: "heuristic-parse", notes: parsed.notes, injectionSignals: scan.signals },
    });
    if (scan.matched) {
      this.record({ type: "intent.injection-flagged", actor: "policy-scanner", payload: { intentId: intent.id, signals: scan.signals } });
    }
    this.persist();
    return {
      intent,
      parsed: { ...parsed, budgetMinor, currency, deadline, injectionSignals: scan.signals },
      transport: this.wiring.kind,
    };
  }

  listIntents(): PurchaseIntent[] {
    return [...this.store.intents.values()];
  }

  getIntent(id: string): PurchaseIntent {
    const intent = this.store.intents.get(id);
    if (intent === undefined) throw new HttpError(404, "intent-not-found", `intent ${id} not found`);
    return intent;
  }

  // -- offers ------------------------------------------------------------------

  offersFor(intentId: string): { intentId: string; origin: string; offers: Offer[] } {
    const intent = this.getIntent(intentId);
    const offers = offersForIntent(intent, this.now());
    for (const offer of offers) this.store.offers.set(offer.id, offer);
    this.record({ type: "offers.listed", payload: { intentId, origin: "simulated-catalog", offerIds: offers.map((o) => o.id) } });
    this.persist();
    return { intentId, origin: "simulated-catalog", offers };
  }

  getOffer(id: string): Offer {
    const offer = this.store.offers.get(id);
    if (offer === undefined) throw new HttpError(404, "offer-not-found", `offer ${id} not found; list offers for the intent first`);
    return offer;
  }

  // -- promises ------------------------------------------------------------------

  private policyContextFor(promise: PurchasePromise, previousApproved?: { version: number; totalMinor: number }): PolicyContext {
    const knownMerchants: PolicyContext["knownMerchants"] = {};
    for (const m of DEMO_MERCHANTS) knownMerchants[m.id] = { owner: m.owner, blocked: m.blocked };
    // Merchants that issued an offer through the platform become known.
    for (const offer of this.store.offers.values()) {
      knownMerchants[offer.merchantId] ??= { owner: "offer-issuer" };
    }
    return {
      now: this.now(),
      killSwitch: this.killSwitchEngaged,
      knownMerchants,
      maxAmountMinor: this.maxAmountMinor(),
      previousApproved,
    };
  }

  createPromise(raw: unknown): PromiseView {
    const input = CreatePromiseSchema.parse(raw);
    const intent = this.getIntent(input.intentId);
    const offer = this.getOffer(input.offerId);
    if (offer.intentId !== intent.id) {
      throw new HttpError(422, "offer-intent-mismatch", "offer does not belong to this intent");
    }
    if (isOfferExpired(offer, this.now())) {
      throw new HttpError(422, "offer-expired", "offer validity window has passed");
    }
    if (offer.total.currency !== intent.budget.currency) {
      throw new HttpError(422, "currency-mismatch", `offer currency ${offer.total.currency} differs from intent budget ${intent.budget.currency}`);
    }
    if (offer.total.amountMinor > intent.budget.amountMinor) {
      throw new HttpError(422, "over-budget", `offer total ${offer.total.amountMinor} exceeds intent budget ${intent.budget.amountMinor}`, {
        totalMinor: offer.total.amountMinor, budgetMinor: intent.budget.amountMinor,
      });
    }
    const now = this.now();
    const promise = createPromise({
      id: randomUUID(),
      intentId: intent.id,
      offerId: offer.id,
      buyerId: input.buyerId ?? intent.buyerId,
      merchantId: offer.merchantId,
      total: offer.total,
      items: offer.items,
      expectedDeliveryDate: offer.expectedDeliveryDate,
      validUntil: new Date(Date.parse(now) + input.validDays * 86_400_000).toISOString(),
      tolerances: { maxDelayDays: input.maxDelayDays, maxPriceDriftBps: input.maxPriceDriftBps },
      evidenceRequirements: input.evidenceRequirements.length > 0 ? input.evidenceRequirements : offer.evidenceRequirements,
      resolutionPolicy: { autoRefundOnMiss: input.autoRefundOnMiss, maxAutoRefundBps: 10000, requireBuyerApproval: input.requireBuyerApproval },
      createdAt: now,
    });
    let state: LifecycleState = "DRAFT";
    state = transition(state, "OFFER_SELECTED");
    state = transition(state, "AWAITING_APPROVAL");
    this.store.promises.set(promise.id, { promise, state, orderIds: [], outcomeIds: [], incidentIds: [] });
    this.record({
      type: "promise.created",
      promiseId: promise.id,
      actor: promise.buyerId,
      payload: { intentId: intent.id, offerId: offer.id, state, total: promise.total, hash: promise.hash, version: 1 },
    });
    this.persist();
    return this.viewOf(promise.id);
  }

  listPromises(state?: string): PromiseView[] {
    const views: PromiseView[] = [];
    for (const record of this.store.promises.values()) {
      if (state !== undefined && record.state !== state) continue;
      views.push(this.viewOf(record.promise.id));
    }
    return views.sort((a, b) => a.promise.createdAt.localeCompare(b.promise.createdAt));
  }

  mustRecord(promiseId: string): { promise: PurchasePromise; state: LifecycleState; orderIds: string[]; outcomeIds: string[]; incidentIds: string[]; lastApproved?: { version: number; totalMinor: number } } {
    const record = this.store.promises.get(promiseId);
    if (record === undefined) throw new HttpError(404, "promise-not-found", `promise ${promiseId} not found`);
    return record;
  }

  viewOf(promiseId: string): PromiseView {
    const record = this.mustRecord(promiseId);
    const decision = evaluate(record.promise, this.policyContextFor(record.promise, record.lastApproved));
    return {
      promise: record.promise,
      state: record.state,
      policy: {
        verdict: decision.verdict,
        reasons: decision.reasons,
        context: { maxAmountMinor: this.maxAmountMinor(), killSwitch: this.killSwitchEngaged, merchantKnown: decision.reasons.includes("merchant-unknown") ? false : undefined },
      },
      orderIds: record.orderIds,
      outcomeIds: record.outcomeIds,
      incidentIds: record.incidentIds,
    };
  }

  approvePromise(promiseId: string, raw: unknown): PromiseView {
    const input = ApprovePromiseSchema.parse(raw);
    const record = this.mustRecord(promiseId);
    if (record.state !== "AWAITING_APPROVAL") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected AWAITING_APPROVAL`);
    }
    const now = this.now();
    const approval: Approval = ApprovalSchema.parse({
      id: randomUUID(),
      promiseId: record.promise.id,
      promiseVersion: record.promise.version,
      promiseHash: record.promise.hash,
      approvedBy: input.approvedBy,
      approvedAt: now,
      expiresAt: new Date(Date.parse(now) + input.expiresHours * 3_600_000).toISOString(),
      method: "manual",
      ...(input.note === undefined ? {} : { note: input.note }),
    });
    const candidate = attachApproval(record.promise, approval);
    const decision = evaluate(candidate, this.policyContextFor(candidate, record.lastApproved));
    if (decision.verdict !== "Cleared") {
      this.record({
        type: "policy.blocked",
        promiseId,
        actor: input.approvedBy,
        payload: { operation: "promise-approve", verdict: decision.verdict, reasons: decision.reasons, version: record.promise.version, hash: record.promise.hash },
      });
      this.persist();
      throw new HttpError(409, "policy-blocked", `policy ${decision.verdict}: ${decision.reasons.join(", ")}`, { verdict: decision.verdict, reasons: decision.reasons });
    }
    record.promise = candidate;
    record.lastApproved = { version: candidate.version, totalMinor: candidate.total.amountMinor };
    record.state = transition(record.state, "APPROVED");
    this.record({
      type: "promise.approved",
      promiseId,
      actor: input.approvedBy,
      payload: { version: candidate.version, hash: candidate.hash, total: candidate.total, approvalId: approval.id, state: record.state },
    });
    this.persist();
    return this.viewOf(promiseId);
  }

  declinePromise(promiseId: string, raw: unknown): PromiseView {
    const input = z.object({ decidedBy: z.string().min(1).max(200), note: z.string().max(1000).optional() }).parse(raw);
    const record = this.mustRecord(promiseId);
    if (record.state !== "AWAITING_APPROVAL") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected AWAITING_APPROVAL`);
    }
    record.state = transition(record.state, "DECLINED");
    this.record({ type: "promise.declined", promiseId, actor: input.decidedBy, payload: { state: record.state, note: input.note ?? null } });
    this.persist();
    return this.viewOf(promiseId);
  }

  changePromise(promiseId: string, raw: unknown): PromiseView & { change: Record<string, unknown> } {
    const input = ChangePromiseSchema.parse(raw);
    const record = this.mustRecord(promiseId);
    if (record.state !== "AWAITING_APPROVAL" && record.state !== "APPROVED") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}; changes are allowed in AWAITING_APPROVAL or APPROVED`);
    }
    const patch: PromisePatch = {
      ...(input.merchantId === undefined ? {} : { merchantId: input.merchantId }),
      ...(input.total === undefined ? {} : { total: input.total }),
      ...(input.items === undefined ? {} : { items: input.items }),
      ...(input.expectedDeliveryDate === undefined ? {} : { expectedDeliveryDate: input.expectedDeliveryDate }),
      ...(input.validUntil === undefined ? {} : { validUntil: input.validUntil }),
    };
    if (Object.keys(patch).length === 0) {
      throw new HttpError(422, "empty-patch", "no change fields supplied");
    }
    const result = proposeChange(record.promise, patch, this.now());
    record.promise = result.promise;
    // Material change on an approved promise reopens it for re-approval. There
    // is deliberately no APPROVED->AWAITING_APPROVAL lifecycle edge (forward
    // progress only), so the reopen is an explicit audited operation, not a
    // silent transition() bypass: the audit trail shows from/to + cause.
    if (record.state === "APPROVED" && result.materialChange) {
      record.state = "AWAITING_APPROVAL";
      this.record({
        type: "promise.reopened",
        promiseId,
        payload: { from: "APPROVED", to: "AWAITING_APPROVAL", cause: "material-change-requires-reapproval", changedFields: result.changedFields, version: result.promise.version },
      });
    }
    const scan = scanInjection(JSON.stringify(patch));
    this.record({
      type: "promise.changed",
      promiseId,
      payload: {
        version: result.promise.version, materialChange: result.materialChange,
        changedFields: result.changedFields, approvalInvalidated: result.approvalInvalidated,
        reason: input.reason ?? null, injectionSignals: scan.signals,
      },
    });
    this.persist();
    return { ...this.viewOf(promiseId), change: { materialChange: result.materialChange, changedFields: result.changedFields, approvalInvalidated: result.approvalInvalidated } };
  }

  // -- payments ------------------------------------------------------------------

  private paymentSnapshot() {
    const store = this.wiring.store;
    return {
      orders: [...store.orders.values()],
      captures: [...store.captures.values()],
      refunds: [...store.refunds.values()],
      operations: [...store.operations.values()],
      idempotency: [...store.idempotency.values()],
    };
  }

  persist(): void {
    this.store.save(this.paymentSnapshot());
  }

  async createOrder(raw: unknown): Promise<{ order: Order; transport: TransportKind; duplicate: boolean }> {
    const input = CreateOrderSchema.parse(raw);
    const record = this.mustRecord(input.promiseId);
    if (record.state !== "APPROVED") {
      // Idempotency first (mirrors the service layer): a known key replays
      // its stored order even though the promise has moved on. Unknown keys
      // are refused WITHOUT touching the provider, so no duplicate order
      // can be created from a stale state.
      if (input.idempotencyKey !== undefined && this.wiring.store.idempotency.has(input.idempotencyKey)) {
        try {
          const { value: order } = await this.wiring.service.createOrder({
            promiseId: record.promise.id,
            amount: record.promise.total,
            idempotencyKey: input.idempotencyKey,
          });
          this.record({ type: "payment.order.replayed", promiseId: record.promise.id, payload: { orderId: order.id, duplicate: true, state: record.state } });
          this.persist();
          return { order, transport: this.wiring.kind, duplicate: true };
        } catch (error: unknown) {
          throw toHttpError(error);
        }
      }
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected APPROVED`);
    }
    if (record.promise.approval === null) {
      throw new HttpError(409, "approval-missing", "promise has no approval attached");
    }
    assertApprovalUsable(record.promise.approval, record.promise, this.now());
    const decision = evaluate(record.promise, this.policyContextFor(record.promise, record.lastApproved));
    if (decision.verdict !== "Cleared") {
      this.record({ type: "policy.blocked", promiseId: record.promise.id, payload: { operation: "order-create", verdict: decision.verdict, reasons: decision.reasons } });
      this.persist();
      throw new HttpError(409, "policy-blocked", `policy ${decision.verdict}: ${decision.reasons.join(", ")}`, { verdict: decision.verdict, reasons: decision.reasons });
    }
    const key = input.idempotencyKey ?? `order_${randomUUID()}`;
    try {
      const { value: order, duplicate } = await this.wiring.service.createOrder({
        promiseId: record.promise.id,
        amount: record.promise.total,
        idempotencyKey: key,
        ...(input.returnUrl === undefined ? {} : { returnUrl: input.returnUrl }),
        ...(input.cancelUrl === undefined ? {} : { cancelUrl: input.cancelUrl }),
      });
      if (!duplicate) {
        record.orderIds.push(order.id);
        record.state = transition(record.state, "PAYMENT_PENDING");
      }
      this.record({
        type: duplicate ? "payment.order.replayed" : "payment.order.created",
        promiseId: record.promise.id,
        payload: { orderId: order.id, providerOrderId: order.providerOrderId ?? null, status: order.status, amount: order.amount, transport: this.wiring.kind, duplicate },
      });
      this.persist();
      return { order, transport: this.wiring.kind, duplicate };
    } catch (error: unknown) {
      throw toHttpError(error);
    }
  }

  async orderStatus(orderId: string, refresh: boolean): Promise<{ order: Order; provider?: unknown; transport: TransportKind }> {
    try {
      const result = await this.wiring.service.getOrderStatus(orderId, { refresh });
      return { order: result.order, provider: result.provider, transport: this.wiring.kind };
    } catch (error: unknown) {
      throw toHttpError(error);
    }
  }

  async buyerApprove(orderId: string): Promise<{ order: Order; transport: TransportKind; origin: string }> {
    if (this.wiring.mock === null) {
      const { order } = await this.orderStatus(orderId, false);
      throw new HttpError(409, "manual-approval-required", "live mode: approve the order at the PayPal approval URL, then capture", { approveUrl: order.approveUrl ?? null });
    }
    const local = this.wiring.store.orders.get(orderId);
    if (local === undefined) throw new HttpError(404, "payment-not-found", `order ${orderId} not found`);
    if (local.providerOrderId === undefined) throw new HttpError(409, "payment-state", "order has no provider order id");
    this.wiring.mock.approveOrder(local.providerOrderId);
    const { order } = await this.orderStatus(orderId, true);
    this.record({ type: "payment.buyer-approved", promiseId: local.promiseId, payload: { orderId, providerOrderId: local.providerOrderId, origin: "mock-simulated-buyer", status: order.status } });
    this.persist();
    return { order, transport: this.wiring.kind, origin: "mock-simulated-buyer" };
  }

  async captureOrder(orderId: string, raw: unknown): Promise<{ capture: unknown; order: Order; transport: TransportKind; duplicate: boolean }> {
    const input = z.object({ idempotencyKey: z.string().min(8).max(160).optional() }).parse(raw);
    const local = this.wiring.store.orders.get(orderId);
    if (local === undefined) throw new HttpError(404, "payment-not-found", `order ${orderId} not found`);
    const record = this.mustRecord(local.promiseId);
    if (record.state !== "PAYMENT_PENDING") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected PAYMENT_PENDING`);
    }
    if (record.promise.approval === null) throw new HttpError(409, "approval-missing", "promise approval missing at capture");
    const decision = evaluate(record.promise, this.policyContextFor(record.promise, record.lastApproved));
    if (decision.verdict !== "Cleared") {
      this.record({ type: "policy.blocked", promiseId: record.promise.id, payload: { operation: "order-capture", verdict: decision.verdict, reasons: decision.reasons } });
      this.persist();
      throw new HttpError(409, "policy-blocked", `policy ${decision.verdict}: ${decision.reasons.join(", ")}`, { verdict: decision.verdict, reasons: decision.reasons });
    }
    const key = input.idempotencyKey ?? `capture_${randomUUID()}`;
    try {
      const { value: capture, duplicate } = await this.wiring.service.captureOrder(
        { orderId, idempotencyKey: key },
        { approval: record.promise.approval, promise: record.promise },
      );
      if (!duplicate) {
        record.state = transition(record.state, "PAYMENT_CAPTURED");
        this.record({ type: "payment.captured", promiseId: record.promise.id, payload: { orderId, captureId: (capture as { id: string }).id, providerCaptureId: (capture as { providerCaptureId: string }).providerCaptureId, amount: (capture as { amount: Money }).amount, transport: this.wiring.kind } });
        record.state = transition(record.state, "OUTCOME_MONITORING");
        this.record({ type: "lifecycle.monitoring", promiseId: record.promise.id, payload: { state: record.state } });
      } else {
        this.record({ type: "payment.capture.replayed", promiseId: record.promise.id, payload: { orderId, captureId: (capture as { id: string }).id, duplicate: true } });
      }
      this.persist();
      const { order } = await this.orderStatus(orderId, false);
      return { capture, order, transport: this.wiring.kind, duplicate };
    } catch (error: unknown) {
      throw toHttpError(error);
    }
  }

  // -- outcomes + incidents ------------------------------------------------------

  private observationOf(payload: Record<string, unknown>): Observation {
    const obs: Observation = {};
    if (typeof payload["deliveredQuantity"] === "number") obs.deliveredQuantity = payload["deliveredQuantity"];
    if (typeof payload["deliveredAt"] === "string") obs.deliveredAt = payload["deliveredAt"];
    if (typeof payload["chargedMinor"] === "number") obs.chargedMinor = payload["chargedMinor"];
    if (typeof payload["status"] === "string") obs.status = payload["status"];
    if (typeof payload["note"] === "string") obs.note = payload["note"];
    return obs;
  }

  recordOutcome(raw: unknown): { outcome: OutcomeEvent; incidents: Incident[] } {
    const input = RecordOutcomeSchema.parse(raw);
    const record = this.mustRecord(input.promiseId);
    if (record.state !== "OUTCOME_MONITORING" && record.state !== "INCIDENT_DETECTED") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}; outcomes are accepted in OUTCOME_MONITORING or INCIDENT_DETECTED`);
    }
    const now = this.now();
    const outcome = OutcomeEventSchema.parse({
      id: randomUUID(),
      promiseId: record.promise.id,
      kind: input.kind,
      observedAt: input.observedAt ?? now,
      summary: input.summary,
      payload: input.payload,
      provenance: input.provenance,
      confidence: input.confidence,
    });
    this.store.outcomes.set(outcome.id, outcome);
    record.outcomeIds.push(outcome.id);
    const evidenceId = randomUUID();
    this.store.evidence.set(evidenceId, EvidenceSchema.parse({
      id: evidenceId,
      promiseId: record.promise.id,
      outcomeEventIds: [outcome.id],
      type: "outcome-bundle",
      sha256: fingerprintOf({ outcomeId: outcome.id, summary: outcome.summary, payload: outcome.payload }),
      collectedAt: now,
      provenance: input.provenance,
      confidence: input.confidence,
    }));
    this.record({
      type: "outcome.recorded",
      promiseId: record.promise.id,
      payload: { outcomeId: outcome.id, kind: outcome.kind, summary: outcome.summary, provenance: input.provenance, confidence: input.confidence, evidenceId },
    });
    const gaps = detectGaps(record.promise, this.observationOf(input.payload));
    const incidents: Incident[] = [];
    if (gaps.length > 0) {
      const worst = gaps.reduce((a, b) => severityRank(b.severity) > severityRank(a.severity) ? b : a);
      const incident: Incident = IncidentSchema.parse({
        id: randomUUID(),
        promiseId: record.promise.id,
        detectedAt: now,
        detectedBy: "policy",
        category: worst.category,
        detail: gaps.map((g) => `[${g.category}/${g.severity}] ${g.detail}`).join(" "),
        severity: worst.severity,
        status: "open",
        linkedOutcomeEventIds: [outcome.id],
        linkedEvidenceIds: [evidenceId],
      });
      this.store.incidents.set(incident.id, incident);
      record.incidentIds.push(incident.id);
      incidents.push(incident);
      if (record.state === "OUTCOME_MONITORING") {
        record.state = transition(record.state, "INCIDENT_DETECTED");
      }
      this.record({ type: "incident.detected", promiseId: record.promise.id, payload: { incidentId: incident.id, category: incident.category, severity: incident.severity, gapCount: gaps.length, state: record.state } });
    }
    this.persist();
    return { outcome, incidents };
  }

  listOutcomes(promiseId?: string): OutcomeEvent[] {
    const all = [...this.store.outcomes.values()];
    return promiseId === undefined ? all : all.filter((o) => o.promiseId === promiseId);
  }

  reportIncident(raw: unknown): Incident {
    const input = ReportIncidentSchema.parse(raw);
    const record = this.mustRecord(input.promiseId);
    if (record.state !== "OUTCOME_MONITORING" && record.state !== "INCIDENT_DETECTED") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}; incidents are accepted in OUTCOME_MONITORING or INCIDENT_DETECTED`);
    }
    const incident: Incident = IncidentSchema.parse({
      id: randomUUID(),
      promiseId: record.promise.id,
      detectedAt: this.now(),
      detectedBy: "buyer",
      category: input.category as Incident["category"],
      detail: input.detail,
      severity: input.severity,
      status: "open",
      linkedOutcomeEventIds: [],
      linkedEvidenceIds: [],
    });
    this.store.incidents.set(incident.id, incident);
    record.incidentIds.push(incident.id);
    if (record.state === "OUTCOME_MONITORING") {
      record.state = transition(record.state, "INCIDENT_DETECTED");
    }
    this.record({ type: "incident.reported", promiseId: record.promise.id, payload: { incidentId: incident.id, category: incident.category, severity: incident.severity } });
    this.persist();
    return incident;
  }

  listIncidents(status?: string): Incident[] {
    const all = [...this.store.incidents.values()];
    return status === undefined ? all : all.filter((i) => i.status === status);
  }

  getIncident(id: string): Incident {
    const incident = this.store.incidents.get(id);
    if (incident === undefined) throw new HttpError(404, "incident-not-found", `incident ${id} not found`);
    return incident;
  }

  // -- AI tasks --------------------------------------------------------------------
  // Model-backed analysis with deterministic fallbacks. The model proposes and
  // explains; gates and policy decide. Nothing here executes payments.

  aiStatus(): {
    keyed: boolean;
    provider: string | null;
    model: string | null;
    ledger: CostLedgerSummary;
  } {
    return {
      keyed: this.ai.providerId !== null,
      provider: this.ai.providerId,
      model: this.ai.model,
      ledger: this.ai.ledgerSummary(),
    };
  }

  async aiAnalyzeIntent(raw: unknown): Promise<Record<string, unknown>> {
    const input = z
      .object({
        rawText: z.string().trim().min(1).max(4000),
        buyerId: z.string().max(200).default("anonymous"),
      })
      .parse(raw);
    const result = await analyzeIntentText(this.ai, input.rawText, input.buyerId, Date.now());
    return result as unknown as Record<string, unknown>;
  }

  async aiAnalyzeIncident(raw: unknown): Promise<Record<string, unknown>> {
    const input = z
      .object({
        promiseId: z.string().min(1),
        observation: z.object({
          deliveredQuantity: z.number().int().min(0).optional(),
          deliveredAt: z.string().max(200).optional(),
          chargedMinor: z.number().int().min(0).optional(),
          status: z.string().max(200).optional(),
          note: z.string().max(2000).optional(),
        }),
      })
      .parse(raw);
    const record = this.mustRecord(input.promiseId);
    const citable = this.listOutcomes(input.promiseId).map((o) => ({ id: o.id, summary: o.summary }));
    const result = await analyzeIncidentForPromise(this.ai, record.promise, input.observation, citable);
    return result as unknown as Record<string, unknown>;
  }

  async aiPlanRecovery(raw: unknown): Promise<Record<string, unknown>> {
    const input = z.object({ incidentId: z.string().min(1) }).parse(raw);
    const incident = this.getIncident(input.incidentId);
    const record = this.mustRecord(incident.promiseId);
    const capture = this.captureForPromise(record.promise.id);
    if (capture === undefined) {
      throw new HttpError(409, "no-capture", "no capture recorded for this promise; cannot size a refund");
    }
    const already = this.wiring.store.refundedMinorForCapture(capture.id);
    const result = await planRecoveryForIncident(this.ai, incident, record.promise, {
      remainingMinor: capture.amount.amountMinor - already,
      currency: capture.amount.currency,
    });
    return result as unknown as Record<string, unknown>;
  }

  // -- resolutions ------------------------------------------------------------------

  private captureForPromise(promiseId: string) {
    for (const capture of this.wiring.store.captures.values()) {
      if (capture.promiseId === promiseId) return capture;
    }
    return undefined;
  }

  proposeResolution(raw: unknown): { proposal: unknown; state: LifecycleState } {
    const input = ProposeResolutionSchema.parse(raw);
    const incident = this.getIncident(input.incidentId);
    if (incident.status !== "open" && incident.status !== "triaged") {
      throw new HttpError(409, "wrong-incident-state", `incident is ${incident.status}, expected open or triaged`);
    }
    const record = this.mustRecord(incident.promiseId);
    if (record.state !== "INCIDENT_DETECTED") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected INCIDENT_DETECTED`);
    }
    const needsAmount = input.kind === "refund-full" || input.kind === "refund-partial";
    if (needsAmount) {
      const capture = this.captureForPromise(record.promise.id);
      if (capture === undefined) throw new HttpError(409, "no-capture", "no capture recorded for this promise; cannot size a refund");
      const already = this.wiring.store.refundedMinorForCapture(capture.id);
      const requested: Money = input.amount ?? { currency: capture.amount.currency, amountMinor: capture.amount.amountMinor - already };
      validateRefundBounds({ captured: capture.amount, alreadyRefundedMinor: already, requested });
    }
    const proposal = ResolutionProposalSchema.parse({
      id: randomUUID(),
      incidentId: incident.id,
      promiseId: record.promise.id,
      version: 1,
      kind: input.kind as ResolutionKind,
      ...(input.amount === undefined ? {} : { amount: input.amount }),
      rationale: input.rationale,
      proposedBy: input.proposedBy,
      proposedAt: this.now(),
    });
    this.store.proposals.set(proposal.id, proposal);
    record.state = transition(record.state, "RESOLUTION_PROPOSED");
    record.state = transition(record.state, "AWAITING_RESOLUTION_APPROVAL");
    this.store.incidents.set(incident.id, { ...incident, status: "resolving" });
    this.record({ type: "resolution.proposed", promiseId: record.promise.id, actor: input.proposedBy, payload: { proposalId: proposal.id, incidentId: incident.id, kind: proposal.kind, amount: proposal.amount ?? null, state: record.state } });
    this.persist();
    return { proposal, state: record.state };
  }

  listProposals(): unknown[] {
    return [...this.store.proposals.values()];
  }

  async decideResolution(proposalId: string, raw: unknown): Promise<Record<string, unknown>> {
    const input = DecideResolutionSchema.parse(raw);
    const proposal = this.store.proposals.get(proposalId);
    if (proposal === undefined) throw new HttpError(404, "proposal-not-found", `proposal ${proposalId} not found`);
    const record = this.mustRecord(proposal.promiseId);
    const incident = this.getIncident(proposal.incidentId);
    if (record.state !== "AWAITING_RESOLUTION_APPROVAL") {
      throw new HttpError(409, "wrong-state", `promise is ${record.state}, expected AWAITING_RESOLUTION_APPROVAL`);
    }
    const now = this.now();
    const approval = ResolutionApprovalSchema.parse({
      id: randomUUID(),
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      decidedBy: input.decidedBy,
      decidedAt: now,
      expiresAt: new Date(Date.parse(now) + 72 * 3_600_000).toISOString(),
      decision: input.decision,
      ...(input.note === undefined ? {} : { note: input.note }),
    });
    this.store.resolutionApprovals.set(approval.id, approval);

    if (input.decision === "rejected") {
      record.state = transition(record.state, "DECLINED");
      this.store.incidents.set(incident.id, { ...incident, status: "dismissed" });
      this.record({ type: "resolution.rejected", promiseId: record.promise.id, actor: input.decidedBy, payload: { proposalId, state: record.state } });
      this.persist();
      return { proposalId, decision: "rejected", state: record.state };
    }

    if (proposal.kind === "escalate") {
      record.state = transition(record.state, "ESCALATED");
      this.record({ type: "resolution.escalated", promiseId: record.promise.id, actor: input.decidedBy, payload: { proposalId, state: record.state } });
      this.persist();
      return { proposalId, decision: "approved", state: record.state };
    }
    if (proposal.kind === "dismiss") {
      record.state = transition(record.state, "RESOLUTION_IN_PROGRESS");
      record.state = transition(record.state, "RESOLUTION_VERIFIED");
      this.store.incidents.set(incident.id, { ...incident, status: "dismissed" });
      this.record({ type: "resolution.dismissed", promiseId: record.promise.id, actor: input.decidedBy, payload: { proposalId, state: record.state } });
      this.persist();
      return { proposalId, decision: "approved", state: record.state };
    }
    record.state = transition(record.state, "RESOLUTION_IN_PROGRESS");
    this.record({ type: "resolution.approved", promiseId: record.promise.id, actor: input.decidedBy, payload: { proposalId, kind: proposal.kind, state: record.state } });

    if (proposal.kind === "refund-full" || proposal.kind === "refund-partial") {
      const capture = this.captureForPromise(record.promise.id);
      if (capture === undefined) throw new HttpError(409, "no-capture", "no capture recorded; cannot execute refund");
      const key = `refund_${randomUUID()}`;
      try {
        const { value: refund } = await this.wiring.service.refundCapture({
          captureId: capture.id,
          promiseId: record.promise.id,
          ...(proposal.amount === undefined ? {} : { amount: proposal.amount }),
          reason: `resolution ${proposal.id}: ${proposal.rationale.slice(0, 200)}`,
          idempotencyKey: key,
        });
        const status = await this.wiring.service.getRefundStatus(refund.id, { refresh: true });
        if (status.refund.status === "succeeded" || status.refund.status === "submitted") {
          record.state = transition(record.state, "RESOLUTION_VERIFIED");
          this.store.incidents.set(incident.id, { ...incident, status: "resolved" });
          this.record({
            type: "refund.verified", promiseId: record.promise.id,
            payload: { proposalId, refundId: refund.id, providerRefundId: refund.providerRefundId ?? null, amount: refund.amount, status: status.refund.status, transport: this.wiring.kind, state: record.state },
          });
          this.persist();
          return { proposalId, decision: "approved", state: record.state, refund: status.refund, provider: status.provider, transport: this.wiring.kind };
        }
        record.state = transition(record.state, "FAILED");
        this.record({ type: "refund.unverified", promiseId: record.promise.id, payload: { proposalId, refundId: refund.id, status: status.refund.status, state: record.state } });
        this.persist();
        throw new HttpError(502, "refund-unverified", `provider refund status is ${status.refund.status}; promise moved to FAILED`, { refund: status.refund });
      } catch (error: unknown) {
        throw toHttpError(error);
      }
    }
    // replacement / credit: no fulfillment integration in this build — the
    // resolution stays verifiably IN_PROGRESS with a manual-fulfillment note.
    this.record({ type: "resolution.manual-fulfillment", promiseId: record.promise.id, payload: { proposalId, kind: proposal.kind, note: "no fulfillment integration in this build; manual completion required" } });
    this.persist();
    return { proposalId, decision: "approved", state: record.state, note: "manual fulfillment required; no fulfillment integration in this build" };
  }

  async refundStatus(refundId: string, refresh: boolean): Promise<{ refund: unknown; provider?: unknown; transport: TransportKind }> {
    try {
      const result = await this.wiring.service.getRefundStatus(refundId, { refresh });
      return { refund: result.refund, provider: result.provider, transport: this.wiring.kind };
    } catch (error: unknown) {
      throw toHttpError(error);
    }
  }

  // -- webhooks ------------------------------------------------------------------

  async handleWebhook(headers: Record<string, string>, rawBody: string): Promise<Record<string, unknown>> {
    try {
      const result = await this.wiring.service.handleWebhook(headers, rawBody);
      this.record({ type: "webhook.received", payload: { outcome: result.outcome, eventType: result.eventType, eventId: result.eventId, transmissionId: result.transmissionId } });
      this.persist();
      return { ...result };
    } catch (error: unknown) {
      throw toHttpError(error);
    }
  }

  // -- audit ------------------------------------------------------------------

  auditList(query: { promiseId?: string; type?: string; limit?: number }): { entries: unknown[]; chainValid: boolean; total: number } {
    let entries = query.promiseId !== undefined ? this.store.auditFor(query.promiseId) : [...this.store.audit];
    if (query.type !== undefined) entries = entries.filter((e) => e.type === query.type);
    const total = entries.length;
    const limit = query.limit ?? 200;
    const slice = entries.slice(Math.max(0, total - limit));
    return { entries: redactValue(slice) as unknown[], chainValid: this.store.verifyAudit(), total };
  }

  auditExport(promiseId?: string): Record<string, unknown> {
    const entries = promiseId !== undefined ? this.store.auditFor(promiseId) : [...this.store.audit];
    const record = promiseId !== undefined ? this.store.promises.get(promiseId) : undefined;
    return redactValue({
      bundle: "afterpact-flight-recorder-export",
      version: 1,
      exportedAt: this.now(),
      transport: this.wiring.kind,
      chainValid: this.store.verifyAudit(),
      promiseId: promiseId ?? null,
      promise: record?.promise ?? null,
      lifecycleState: record?.state ?? null,
      entries,
      integrityNote: "SHA-256 hash chain over (seq, prevHash, type, promiseId, actor, payload, recordedAt). Hashing is tamper-evidence, not legal immutability.",
    }) as Record<string, unknown>;
  }

  // -- metrics ------------------------------------------------------------------

  metrics(): Record<string, unknown> {
    const byState: Record<string, number> = {};
    let capturedMinor = 0;
    let refundedMinor = 0;
    let atRiskMinor = 0;
    let currency = "USD";
    for (const record of this.store.promises.values()) {
      byState[record.state] = (byState[record.state] ?? 0) + 1;
      currency = record.promise.total.currency;
    }
    for (const capture of this.wiring.store.captures.values()) {
      capturedMinor += capture.amount.amountMinor;
      const refunded = this.wiring.store.refundedMinorForCapture(capture.id);
      refundedMinor += refunded;
      const rec = this.store.promises.get(capture.promiseId);
      if (rec !== undefined && rec.state !== "RESOLUTION_VERIFIED" && rec.state !== "CANCELED") {
        atRiskMinor += capture.amount.amountMinor - refunded;
      }
    }
    const openIncidents = [...this.store.incidents.values()].filter((i) => i.status === "open" || i.status === "triaged" || i.status === "resolving");
    const queue = [...this.store.proposals.values()].filter((p) => {
      const rec = this.store.promises.get(p.promiseId);
      return rec?.state === "AWAITING_RESOLUTION_APPROVAL";
    });
    const recent = [...this.store.audit].slice(-10).reverse();
    return {
      transport: this.wiring.kind,
      currency,
      promisesByState: byState,
      promiseCount: this.store.promises.size,
      capturedMinor,
      refundedMinor,
      atRiskMinor,
      openIncidentCount: openIncidents.length,
      openIncidents: openIncidents.slice(0, 20),
      resolutionQueue: queue,
      intentCount: this.store.intents.size,
      recentEvents: redactValue(recent),
      chainValid: this.store.verifyAudit(),
      killSwitch: this.killSwitchEngaged,
    };
  }

  // -- Channel3 discovery ---------------------------------------------------------

  discoveryStatus(): Channel3Status {
    return this.channel3.status;
  }

  async searchDiscovery(raw: unknown): Promise<Record<string, unknown>> {
    const input = DiscoverySearchSchema.parse(raw);
    const result = await this.channel3.searchProducts(input);
    this.record({
      type: "discovery.search",
      actor: "discovery-client",
      payload: {
        origin: result.meta.origin,
        query: result.meta.query,
        candidateCount: result.candidates.length,
        latencyMs: result.meta.latencyMs,
        locale: result.meta.locale,
      },
    });
    this.persist();
    return result as unknown as Record<string, unknown>;
  }

  async compareDiscovery(raw: unknown): Promise<Record<string, unknown>> {
    const input = DiscoveryCompareSchema.parse(raw);
    const result = await this.channel3.compareProducts(input);
    this.record({
      type: "discovery.compare",
      actor: "discovery-client",
      payload: {
        origin: "channel3-live",
        requested: input.productIds.length,
        failures: result.failures.length,
      },
    });
    this.persist();
    return result as unknown as Record<string, unknown>;
  }

  async lookupDiscovery(raw: unknown): Promise<Record<string, unknown>> {
    const input = DiscoveryLookupSchema.parse(raw);
    const candidate = await this.channel3.lookupUrl(input);
    this.record({
      type: "discovery.lookup",
      actor: "discovery-client",
      payload: { origin: "channel3-live", url: input.url, productId: candidate.productId },
    });
    this.persist();
    return candidate as unknown as Record<string, unknown>;
  }

  // -- Commerce Intelligence Studio ------------------------------------------------

  studioDatasets(): StudioDatasets {
    return buildStudioDatasets(this.store, this.wiring.store, this.now());
  }

  studioCommand(raw: unknown): StudioCommandResult {
    const input = z.object({ command: z.string().min(1).max(500) }).parse(raw);
    const parsed = parseStudioCommand(input.command);
    return applyStudioCommand(this.studioDatasets(), parsed);
  }

  // -- Recovery timeline ------------------------------------------------------

  timelineFor(promiseId: string): RecoveryTimeline {
    const record = this.mustRecord(promiseId);
    const incidents = record.incidentIds
      .map((id) => this.store.incidents.get(id))
      .filter((incident): incident is NonNullable<typeof incident> => incident !== undefined);
    const outcomes = record.outcomeIds
      .map((id) => this.store.outcomes.get(id))
      .filter((outcome): outcome is NonNullable<typeof outcome> => outcome !== undefined);
    const proposals = [...this.store.proposals.values()].filter((p) => p.promiseId === promiseId);
    const proposalIds = new Set(proposals.map((p) => p.id));
    const approvals = [...this.store.resolutionApprovals.values()].filter((a) => proposalIds.has(a.proposalId));
    const captures = [...this.wiring.store.captures.values()].filter((c) => c.promiseId === promiseId);
    const refunds = [...this.wiring.store.refunds.values()].filter((r) => r.promiseId === promiseId);
    return buildTimeline({ record, outcomes, incidents, proposals, approvals, captures, refunds, nowIso: this.now() });
  }

  // -- internal helpers ------------------------------------------------------------

  record(input: { type: string; promiseId?: string; actor?: string; payload?: Record<string, unknown> }): void {
    this.store.record({
      type: input.type,
      payload: redactValue(input.payload ?? {}) as Record<string, unknown>,
      recordedAt: this.now(),
      ...(input.promiseId === undefined ? {} : { promiseId: input.promiseId }),
      ...(input.actor === undefined ? {} : { actor: input.actor }),
    });
  }

  flagshipOfferFor(intent: PurchaseIntent): Offer {
    const offer = flagshipOffer(intent, this.now());
    this.store.offers.set(offer.id, offer);
    return offer;
  }
}

function severityRank(severity: string): number {
  switch (severity) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    default: return 1;
  }
}

export type { DemoActResult };
export type PurchaseIntentType = PurchaseIntent;
export type IncidentCategoryType = IncidentCategory;
