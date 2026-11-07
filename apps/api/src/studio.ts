import type { AppStore } from "./store";
import type {
  Capture,
  LifecycleState,
  RefundOperation,
} from "../../../packages/domain/src/index";

/**
 * Commerce Intelligence Studio — dataset + natural-language command layer.
 *
 * Every dataset is built from live AFTERPACT store state (promises,
 * incidents, captures, refunds, outcomes, evidence): no static mockups.
 * The frontend renders these rows with AG Grid Community tables
 * (MIT-licensed, vendored) with cross-filtering; see
 * docs/sponsors/AG_STUDIO_UPGRADE_PATH.md for the AG Studio migration.
 *
 * The NL command box (`parseStudioCommand`) is a strict, deterministic
 * filter language — not an LLM call. Unknown tokens are rejected with a
 * hint instead of silently ignored, so a command like
 * "incidents unresolved refunds >$100" always means exactly what ran.
 */

// ---------------------------------------------------------------------------
// Dataset rows (plain JSON; safe to serialize)
// ---------------------------------------------------------------------------

export interface StudioPromiseRow {
  id: string;
  merchantId: string;
  state: LifecycleState;
  totalMinor: number;
  currency: string;
  version: number;
  approved: boolean;
  incidentCount: number;
  openIncidentCount: number;
  outcomeCount: number;
  evidenceCount: number;
  evidenceRequired: number;
  createdAt: string;
}

export interface StudioIncidentRow {
  id: string;
  promiseId: string;
  merchantId: string | null;
  category: string;
  severity: string;
  status: string;
  detectedAt: string;
  detectedBy: string;
  ageHours: number;
  /** Sum of proposed refund amounts for this incident (minor units). */
  proposedRefundMinor: number;
  /** Unrefunded captured balance on the linked promise (minor units). */
  promiseUnrefundedMinor: number;
  currency: string | null;
  proposalCount: number;
  decided: boolean;
}

export interface StudioCaptureRow {
  id: string;
  promiseId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  status: string;
  refundedMinor: number;
  remainingMinor: number;
  capturedAt: string;
}

export interface StudioRefundRow {
  id: string;
  promiseId: string;
  captureId: string;
  amountMinor: number;
  currency: string;
  status: string;
  reason: string;
  createdAt: string;
}

export interface StudioKpis {
  generatedAt: string;
  origin: "real-api";
  promiseCount: number;
  promisesByState: Record<string, number>;
  openIncidentCount: number;
  incidentsByStatus: Record<string, number>;
  incidentsByCategory: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  capturedMinor: number;
  refundedMinor: number;
  /** Refunded / captured in basis points; null when nothing captured. */
  refundRateBps: number | null;
  atRiskMinor: number;
  /** Open incidents on promises with unrefunded captured balance. */
  unresolvedRefundIncidentCount: number;
  unresolvedRefundMinor: number;
  evidenceRequired: number;
  evidenceCollected: number;
  outcomeCount: number;
}

export interface StudioDatasets {
  kpis: StudioKpis;
  promises: StudioPromiseRow[];
  incidents: StudioIncidentRow[];
  captures: StudioCaptureRow[];
  refunds: StudioRefundRow[];
}

export interface PaymentData {
  captures: Map<string, Capture>;
  refunds: Map<string, RefundOperation>;
  refundedMinorForCapture: (captureId: string) => number;
}

const OPEN_INCIDENT = new Set(["open", "triaged", "resolving"]);

function ageHours(nowMs: number, iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(((nowMs - ms) / 3_600_000) * 10) / 10);
}

export function buildStudioDatasets(store: AppStore, payments: PaymentData, nowIso: string): StudioDatasets {
  const nowMs = Date.parse(nowIso);
  const incidentIdsByPromise = new Map<string, string[]>();
  for (const incident of store.incidents.values()) {
    const list = incidentIdsByPromise.get(incident.promiseId) ?? [];
    list.push(incident.id);
    incidentIdsByPromise.set(incident.promiseId, list);
  }
  const proposalsByIncident = new Map<string, { amountMinor: number; decided: boolean }[]>();
  for (const proposal of store.proposals.values()) {
    const list = proposalsByIncident.get(proposal.incidentId) ?? [];
    const decided = [...store.resolutionApprovals.values()].some((a) => a.proposalId === proposal.id);
    list.push({ amountMinor: proposal.amount?.amountMinor ?? 0, decided });
    proposalsByIncident.set(proposal.incidentId, list);
  }
  const capturesByPromise = new Map<string, Capture[]>();
  for (const capture of payments.captures.values()) {
    const list = capturesByPromise.get(capture.promiseId) ?? [];
    list.push(capture);
    capturesByPromise.set(capture.promiseId, list);
  }
  const evidenceByPromise = new Map<string, number>();
  for (const evidence of store.evidence.values()) {
    evidenceByPromise.set(evidence.promiseId, (evidenceByPromise.get(evidence.promiseId) ?? 0) + 1);
  }

  const promises: StudioPromiseRow[] = [...store.promises.values()].map((record) => {
    const ids = incidentIdsByPromise.get(record.promise.id) ?? [];
    const open = ids.filter((id) => {
      const incident = store.incidents.get(id);
      return incident !== undefined && OPEN_INCIDENT.has(incident.status);
    }).length;
    return {
      id: record.promise.id,
      merchantId: record.promise.merchantId,
      state: record.state,
      totalMinor: record.promise.total.amountMinor,
      currency: record.promise.total.currency,
      version: record.promise.version,
      approved: record.promise.approval !== null,
      incidentCount: ids.length,
      openIncidentCount: open,
      outcomeCount: record.outcomeIds.length,
      evidenceCount: evidenceByPromise.get(record.promise.id) ?? 0,
      evidenceRequired: record.promise.evidenceRequirements.length,
      createdAt: record.promise.createdAt,
    };
  });

  const incidents: StudioIncidentRow[] = [...store.incidents.values()].map((incident) => {
    const record = store.promises.get(incident.promiseId);
    const proposals = proposalsByIncident.get(incident.id) ?? [];
    const captures = capturesByPromise.get(incident.promiseId) ?? [];
    const unrefunded = captures.reduce((sum, capture) => {
      const refunded = payments.refundedMinorForCapture(capture.id);
      return sum + Math.max(0, capture.amount.amountMinor - refunded);
    }, 0);
    return {
      id: incident.id,
      promiseId: incident.promiseId,
      merchantId: record?.promise.merchantId ?? null,
      category: incident.category,
      severity: incident.severity,
      status: incident.status,
      detectedAt: incident.detectedAt,
      detectedBy: incident.detectedBy,
      ageHours: ageHours(nowMs, incident.detectedAt),
      proposedRefundMinor: proposals.reduce((sum, p) => sum + p.amountMinor, 0),
      promiseUnrefundedMinor: unrefunded,
      currency: record?.promise.total.currency ?? captures[0]?.amount.currency ?? null,
      proposalCount: proposals.length,
      decided: proposals.some((p) => p.decided),
    };
  });

  const captures: StudioCaptureRow[] = [...payments.captures.values()].map((capture) => {
    const refunded = payments.refundedMinorForCapture(capture.id);
    return {
      id: capture.id,
      promiseId: capture.promiseId,
      orderId: capture.orderId,
      amountMinor: capture.amount.amountMinor,
      currency: capture.amount.currency,
      status: capture.status,
      refundedMinor: refunded,
      remainingMinor: Math.max(0, capture.amount.amountMinor - refunded),
      capturedAt: capture.capturedAt,
    };
  });

  const refunds: StudioRefundRow[] = [...payments.refunds.values()].map((refund) => ({
    id: refund.id,
    promiseId: refund.promiseId,
    captureId: refund.captureId,
    amountMinor: refund.amount.amountMinor,
    currency: refund.amount.currency,
    status: refund.status,
    reason: refund.reason,
    createdAt: refund.createdAt,
  }));

  const promisesByState: Record<string, number> = {};
  for (const row of promises) promisesByState[row.state] = (promisesByState[row.state] ?? 0) + 1;
  const incidentsByStatus: Record<string, number> = {};
  const incidentsByCategory: Record<string, number> = {};
  const incidentsBySeverity: Record<string, number> = {};
  for (const row of incidents) {
    incidentsByStatus[row.status] = (incidentsByStatus[row.status] ?? 0) + 1;
    incidentsByCategory[row.category] = (incidentsByCategory[row.category] ?? 0) + 1;
    incidentsBySeverity[row.severity] = (incidentsBySeverity[row.severity] ?? 0) + 1;
  }
  const capturedMinor = captures.reduce((n, c) => n + c.amountMinor, 0);
  const refundedMinor = captures.reduce((n, c) => n + c.refundedMinor, 0);
  const atRiskMinor = captures.reduce((n, c) => {
    const record = store.promises.get(c.promiseId);
    if (record === undefined || record.state === "RESOLUTION_VERIFIED" || record.state === "CANCELED") return n;
    return n + c.remainingMinor;
  }, 0);
  const unresolved = incidents.filter((i) => OPEN_INCIDENT.has(i.status) && i.promiseUnrefundedMinor > 0);

  return {
    kpis: {
      generatedAt: nowIso,
      origin: "real-api",
      promiseCount: promises.length,
      promisesByState,
      openIncidentCount: incidents.filter((i) => OPEN_INCIDENT.has(i.status)).length,
      incidentsByStatus,
      incidentsByCategory,
      incidentsBySeverity,
      capturedMinor,
      refundedMinor,
      refundRateBps: capturedMinor > 0 ? Math.round((refundedMinor / capturedMinor) * 10_000) : null,
      atRiskMinor,
      unresolvedRefundIncidentCount: unresolved.length,
      unresolvedRefundMinor: unresolved.reduce((n, i) => n + i.promiseUnrefundedMinor, 0),
      evidenceRequired: promises.reduce((n, p) => n + p.evidenceRequired, 0),
      evidenceCollected: promises.reduce((n, p) => n + p.evidenceCount, 0),
      outcomeCount: store.outcomes.size,
    },
    promises,
    incidents,
    captures,
    refunds,
  };
}

// ---------------------------------------------------------------------------
// NL command language (strict; rejects what it cannot understand)
// ---------------------------------------------------------------------------

export class StudioCommandError extends Error {
  constructor(
    message: string,
    public readonly hint: string,
    public readonly understood: string[] = [],
  ) {
    super(message);
    this.name = "StudioCommandError";
  }
}

export type StudioEntity = "incidents" | "promises" | "refunds" | "captures";

export interface StudioFilter {
  field: string;
  op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains";
  value: string | number;
  minorValue?: number;
}

export interface ParsedStudioCommand {
  entity: StudioEntity;
  filters: StudioFilter[];
  explanation: string;
  understood: string[];
}

const ENTITY_ALIASES: Record<string, StudioEntity> = {
  incident: "incidents",
  incidents: "incidents",
  promise: "promises",
  promises: "promises",
  refund: "refunds",
  refunds: "refunds",
  capture: "captures",
  captures: "captures",
  payment: "captures",
  payments: "captures",
};

const UNRESOLVED_STATUSES = ["open", "triaged", "resolving"];

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens.filter((t) => t !== "");
}

/** Parse `$100`, `$100.50`, `100minor`, or `100.50usd`-style amounts to minor units (USD 2-decimal). */
function parseMoneyToken(token: string): number | null {
  const minorMatch = token.match(/^(\d+)minor$/i);
  if (minorMatch !== null) {
    const value = Number.parseInt(minorMatch[1] as string, 10);
    return Number.isSafeInteger(value) ? value : null;
  }
  const dollarMatch = token.match(/^\$([\d,]+(?:\.\d{1,2})?)$/);
  if (dollarMatch !== null) {
    const major = Number.parseFloat((dollarMatch[1] as string).replace(/,/g, ""));
    if (!Number.isFinite(major) || major < 0) return null;
    return Math.round(major * 100);
  }
  return null;
}

const COMPARISON_OPS = new Set([">", ">=", "<", "<=", "=", "!=", "=="]);
const AMOUNT_FIELDS = new Set(["refunds", "refund", "amount", "total", "exposure", "unrefunded", "remaining"]);

function normalizeOp(raw: string): StudioFilter["op"] {
  if (raw === "==") return "=";
  return raw as StudioFilter["op"];
}

export function parseStudioCommand(text: string): ParsedStudioCommand {
  const tokens = tokenize(text.trim());
  if (tokens.length === 0) {
    throw new StudioCommandError(
      "Empty Studio command.",
      'Start with an entity: "incidents", "promises", "refunds", or "captures". Example: incidents unresolved refunds >$100',
    );
  }
  const entityRaw = (tokens[0] as string).toLowerCase();
  const entity = ENTITY_ALIASES[entityRaw];
  if (entity === undefined) {
    throw new StudioCommandError(
      `Unknown Studio entity "${tokens[0]}".`,
      'Start with an entity: "incidents", "promises", "refunds", or "captures". Example: incidents unresolved refunds >$100',
    );
  }
  const filters: StudioFilter[] = [];
  const understood: string[] = [`entity = ${entity}`];
  const rest = tokens.slice(1);
  let index = 0;

  const peek = (): string | undefined => rest[index];
  const next = (): string | undefined => rest[index++];

  while (index < rest.length) {
    let token = (next() as string).toLowerCase();
    // Fully attached amount filter ("refunds>$100") → split into parts.
    const fused = token.match(/^(refunds?|amount|total|exposure|unrefunded|remaining)(>=|<=|!=|==|>|<|=)(.+)$/);
    if (fused !== null) {
      index -= 1;
      rest.splice(index, 1, fused[1] as string, fused[2] as string, fused[3] as string);
      token = (next() as string).toLowerCase();
    }
    // Bare status words.
    if (token === "unresolved") {
      filters.push({ field: "status", op: "=", value: "__unresolved__" });
      understood.push("status in (open, triaged, resolving)");
      continue;
    }
    if (["open", "triaged", "resolving", "resolved", "dismissed"].includes(token) && entity === "incidents") {
      filters.push({ field: "status", op: "=", value: token });
      understood.push(`status = ${token}`);
      continue;
    }
    // severity <level>
    if (token === "severity") {
      const level = next();
      if (level === undefined || !["low", "medium", "high", "critical"].includes(level.toLowerCase())) {
        throw new StudioCommandError(
          `Incomplete severity filter after "${rest.slice(0, index).join(" ")}".`,
          'Use: severity <low|medium|high|critical>. Example: incidents severity high',
          understood,
        );
      }
      filters.push({ field: "severity", op: "=", value: level.toLowerCase() });
      understood.push(`severity = ${level.toLowerCase()}`);
      continue;
    }
    // category <slug>
    if (token === "category") {
      const category = next();
      if (category === undefined || category.trim() === "") {
        throw new StudioCommandError("Incomplete category filter.", "Use: category <slug>. Example: incidents category late-delivery", understood);
      }
      filters.push({ field: "category", op: "=", value: category.toLowerCase() });
      understood.push(`category = ${category.toLowerCase()}`);
      continue;
    }
    // state <STATE>
    if (token === "state") {
      const state = next();
      if (state === undefined || state.trim() === "") {
        throw new StudioCommandError("Incomplete state filter.", "Use: state <LIFECYCLE_STATE>. Example: promises state APPROVED", understood);
      }
      filters.push({ field: "state", op: "=", value: state.toUpperCase() });
      understood.push(`state = ${state.toUpperCase()}`);
      continue;
    }
    // currency <CODE>
    if (token === "currency") {
      const code = next();
      if (code === undefined || !/^[A-Za-z]{3}$/.test(code)) {
        throw new StudioCommandError("Incomplete currency filter.", "Use: currency <3-letter code>. Example: refunds currency USD", understood);
      }
      filters.push({ field: "currency", op: "=", value: code.toUpperCase() });
      understood.push(`currency = ${code.toUpperCase()}`);
      continue;
    }
    // merchant <fragment>
    if (token === "merchant") {
      const fragment = next();
      if (fragment === undefined || fragment.trim() === "") {
        throw new StudioCommandError("Incomplete merchant filter.", "Use: merchant <id fragment>. Example: promises merchant acme", understood);
      }
      filters.push({ field: "merchant", op: "contains", value: fragment.toLowerCase() });
      understood.push(`merchant contains "${fragment.toLowerCase()}"`);
      continue;
    }
    // <amount-field> <op> <$money> — the op may be attached (">$100").
    if (AMOUNT_FIELDS.has(token)) {
      let op = next();
      let amountToken = next();
      if (op !== undefined && amountToken === undefined) {
        const attached = op.match(/^(>=|<=|!=|==|>|<|=)(.+)$/);
        if (attached !== null) {
          op = attached[1];
          amountToken = attached[2];
        }
      }
      if (op === undefined || !COMPARISON_OPS.has(op) || amountToken === undefined) {
        throw new StudioCommandError(
          `Incomplete amount filter after "${token}".`,
          'Use: <refunds|amount|total|exposure> <op> <$money>. Example: incidents unresolved refunds >$100',
          understood,
        );
      }
      const minor = parseMoneyToken(amountToken);
      if (minor === null) {
        throw new StudioCommandError(
          `Unrecognized amount "${amountToken}".`,
          'Amounts use dollars ("$100", "$100.50") or explicit minor units ("10000minor"). Example: refunds amount >=$50',
          understood,
        );
      }
      filters.push({ field: token, op: normalizeOp(op), value: amountToken, minorValue: minor });
      understood.push(`${token} ${normalizeOp(op)} ${amountToken}`);
      continue;
    }
    // <word> <op> <value> generic comparisons (e.g. age-hours > 48)
    const lookahead = peek();
    if (lookahead !== undefined && COMPARISON_OPS.has(lookahead)) {
      const op = next() as string;
      const value = next();
      if (value === undefined) {
        throw new StudioCommandError(`Incomplete comparison after "${token} ${op}".`, "Comparisons need a value. Example: incidents age-hours > 48", understood);
      }
      const numeric = Number(value);
      filters.push({
        field: token,
        op: normalizeOp(op),
        value: Number.isFinite(numeric) && value.trim() !== "" ? numeric : value,
      });
      understood.push(`${token} ${normalizeOp(op)} ${value}`);
      continue;
    }
    throw new StudioCommandError(
      `Cannot understand "${token}" in "${text}".`,
      'Supported: status words (unresolved/open/...), severity <level>, category <slug>, state <STATE>, currency <CODE>, merchant <fragment>, <amount-field> <op> <$money>. Example: incidents unresolved refunds >$100',
      understood,
    );
  }

  return {
    entity,
    filters,
    explanation: understood.join("; "),
    understood,
  };
}

type StudioRow = StudioIncidentRow | StudioPromiseRow | StudioRefundRow | StudioCaptureRow;

function rowAmountMinor(entity: StudioEntity, row: StudioRow, field: string): number | null {
  if (entity === "incidents") {
    const incident = row as StudioIncidentRow;
    if (field === "refunds" || field === "refund" || field === "exposure" || field === "unrefunded") {
      return incident.promiseUnrefundedMinor;
    }
    if (field === "amount") return incident.proposedRefundMinor;
    return null;
  }
  if (entity === "promises") {
    const promise = row as StudioPromiseRow;
    if (field === "total" || field === "amount") return promise.totalMinor;
    return null;
  }
  if (entity === "refunds") {
    if (field === "amount" || field === "refunds" || field === "refund" || field === "total") {
      return (row as StudioRefundRow).amountMinor;
    }
    return null;
  }
  if (field === "amount" || field === "total") return (row as StudioCaptureRow).amountMinor;
  if (field === "remaining" || field === "unrefunded") return (row as StudioCaptureRow).remainingMinor;
  if (field === "refunds" || field === "refund") return (row as StudioCaptureRow).refundedMinor;
  return null;
}

function compareNumbers(actual: number, op: StudioFilter["op"], expected: number): boolean {
  switch (op) {
    case "=": return actual === expected;
    case "!=": return actual !== expected;
    case ">": return actual > expected;
    case ">=": return actual >= expected;
    case "<": return actual < expected;
    case "<=": return actual <= expected;
    default: return false;
  }
}

function matchesFilter(entity: StudioEntity, row: StudioRow, filter: StudioFilter): boolean {
  const record = row as unknown as Record<string, unknown>;
  if (filter.field === "status" && filter.value === "__unresolved__" && entity === "incidents") {
    return UNRESOLVED_STATUSES.includes(String(record["status"]));
  }
  if (AMOUNT_FIELDS.has(filter.field) && filter.minorValue !== undefined) {
    const actual = rowAmountMinor(entity, row, filter.field);
    if (actual === null) return false;
    return compareNumbers(actual, filter.op, filter.minorValue);
  }
  if (filter.field === "merchant") {
    const haystack = entity === "incidents"
      ? String((row as StudioIncidentRow).merchantId ?? "")
      : String((row as StudioPromiseRow).merchantId ?? "");
    return haystack.toLowerCase().includes(String(filter.value));
  }
  const actual = record[filter.field === "age-hours" ? "ageHours" : filter.field];
  if (filter.op === "contains") {
    return String(actual ?? "").toLowerCase().includes(String(filter.value).toLowerCase());
  }
  if (typeof filter.value === "number" && typeof actual === "number") {
    return compareNumbers(actual, filter.op, filter.value);
  }
  if (filter.op === "=") return String(actual ?? "").toLowerCase() === String(filter.value).toLowerCase();
  if (filter.op === "!=") return String(actual ?? "").toLowerCase() !== String(filter.value).toLowerCase();
  return false;
}

export interface StudioCommandResult {
  entity: StudioEntity;
  total: number;
  returned: number;
  rows: StudioRow[];
  applied: string[];
  explanation: string;
}

const MAX_COMMAND_ROWS = 200;

export function applyStudioCommand(datasets: StudioDatasets, parsed: ParsedStudioCommand): StudioCommandResult {
  const source: StudioRow[] = datasets[parsed.entity];
  const rows = source.filter((row) => parsed.filters.every((filter) => matchesFilter(parsed.entity, row, filter)));
  return {
    entity: parsed.entity,
    total: rows.length,
    returned: Math.min(rows.length, MAX_COMMAND_ROWS),
    rows: rows.slice(0, MAX_COMMAND_ROWS),
    applied: parsed.understood,
    explanation: parsed.explanation,
  };
}
