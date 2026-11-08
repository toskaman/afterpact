import { z } from "zod";
import {
  AIService,
  vultrConfigFromEnv,
  VultrInferenceProvider,
} from "../../../packages/ai/src/index";
import type {
  Incident,
  PurchasePromise,
} from "../../../packages/domain/src/index";
import { detectGaps, type Observation } from "./detect";
import { parseIntentText, scanInjection } from "./nlparse";

// ---------------------------------------------------------------------------
// Task output schemas (model outputs MUST validate; deterministic gates apply
// after validation regardless of which path produced the values).
// ---------------------------------------------------------------------------

export const IntentAnalysisSchema = z.object({
  quantity: z.number().int().min(1),
  budgetMinor: z.number().int().min(0).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  productType: z.string().max(120).nullable(),
  deadlineDays: z.number().int().min(0).nullable(),
  requirements: z.array(z.string().max(200)).max(20),
  ambiguities: z.array(z.string().max(200)).max(20),
  tradeoffs: z.array(z.string().max(200)).max(20),
});
export type IntentAnalysis = z.infer<typeof IntentAnalysisSchema>;

export const IncidentAnalysisSchema = z.object({
  category: z.string().min(1),
  interpretation: z.string().min(1).max(2000),
  evidenceRefs: z.array(z.string()).max(20),
  missingInfo: z.array(z.string().max(300)).max(20),
  uncertainty: z.enum(["low", "medium", "high"]),
  escalate: z.boolean(),
});
export type IncidentAnalysis = z.infer<typeof IncidentAnalysisSchema>;

export const RecoveryPlanSchema = z.object({
  strategy: z.enum([
    "request-evidence",
    "contact-merchant",
    "schedule-replacement",
    "partial-refund",
    "full-refund",
    "escalate-human",
  ]),
  rationale: z.string().min(1).max(2000),
  evidenceRefs: z.array(z.string()).max(20),
  proposedAmountMinor: z.number().int().min(0).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  risks: z.array(z.string().max(300)).max(20),
  requiredApprovals: z.array(z.string().max(120)).max(10),
});
export type RecoveryPlan = z.infer<typeof RecoveryPlanSchema>;

// ---------------------------------------------------------------------------
// Pure deterministic gates (no model involved; unit-tested).
// ---------------------------------------------------------------------------

export function verifyEvidenceRefs(
  refs: string[],
  validIds: string[],
): { kept: string[]; dropped: string[] } {
  const valid = new Set(validIds);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const ref of refs) {
    if (!valid.has(ref)) {
      if (!dropped.includes(ref)) dropped.push(ref);
      continue;
    }
    if (!kept.includes(ref)) kept.push(ref);
  }
  return { kept, dropped };
}

export function gateIncidentCategory(
  category: string,
  gaps: { category: string }[],
): { accepted: boolean; reason: string } {
  const detected = gaps.map((g) => g.category);
  if (detected.includes(category)) {
    return { accepted: true, reason: "category matches deterministic detection" };
  }
  return {
    accepted: false,
    reason: `category ${category} has no detected gap; detected: ${detected.join(", ") || "none"}`,
  };
}

export type RecoveryGateVerdict = "approved-as-proposed" | "refused" | "needs-human";

export function gateRecoveryAmount(
  proposedMinor: number | null,
  remainingMinor: number,
  _currency: string,
): { verdict: RecoveryGateVerdict; amountMinor: number | null; reason: string } {
  void _currency;
  if (proposedMinor === null) {
    return { verdict: "needs-human", amountMinor: null, reason: "no amount proposed; operator must size it" };
  }
  if (proposedMinor <= remainingMinor) {
    return { verdict: "approved-as-proposed", amountMinor: proposedMinor, reason: "within remaining bounds" };
  }
  return {
    verdict: "refused",
    amountMinor: null,
    reason: `proposed ${proposedMinor} exceeds remaining ${remainingMinor}; over-refund refused, never clamped silently`,
  };
}

// ---------------------------------------------------------------------------
// Wiring + tasks
// ---------------------------------------------------------------------------

export function wireAIService(env: NodeJS.ProcessEnv = process.env): AIService {
  const { config, hasKey } = vultrConfigFromEnv(env);
  return new AIService(hasKey ? new VultrInferenceProvider(config) : null);
}

const INTENT_SYSTEM = [
  "Extract structured purchase constraints from the buyer message.",
  "Never invent requirements, budgets, quantities, or deadlines not stated;",
  "put anything uncertain in ambiguities. Amounts in minor units or null.",
].join(" ");

// Exact output keys, sent with the prompt so the model never has to guess
// field names. Must stay in sync with IntentAnalysisSchema (unit-tested).
export const INTENT_OUTPUT_FIELDS = [
  'Exact JSON keys, no others: quantity:int>=1, budgetMinor:int>=0|null,',
  'currency:"XXX"|null, productType:string<=120|null, deadlineDays:int>=0|null,',
  "requirements:string[<=20], ambiguities:string[<=20], tradeoffs:string[<=20].",
  "All three arrays required (use [] when empty). Numbers are JSON numbers, never strings.",
].join(" ");

const INCIDENT_SYSTEM = [
  "Interpret promise-vs-observation gaps for a merchant operator.",
  "Cite ONLY evidence ids from citableEvidence. Never invent prices, stock,",
  "or delivery facts. State missing info, uncertainty, and whether to escalate.",
].join(" ");

// Must stay in sync with IncidentAnalysisSchema (unit-tested).
export const INCIDENT_OUTPUT_FIELDS = [
  'Exact JSON keys, no others: category:string (one of the detected gap categories),',
  "interpretation:string<=2000, evidenceRefs:string[<=20] (ids from citableEvidence only),",
  'missingInfo:string[<=20], uncertainty:"low"|"medium"|"high", escalate:boolean.',
].join(" ");

const RECOVERY_SYSTEM = [
  "Recommend ONE recovery strategy with rationale. Amounts in minor units or",
  "null, never above the stated remaining bounds. A human operator approves;",
  "you never execute payments. List risks and required approvals.",
].join(" ");

// Must stay in sync with RecoveryPlanSchema (unit-tested).
export const RECOVERY_OUTPUT_FIELDS = [
  'Exact JSON keys, no others: strategy:"request-evidence"|"contact-merchant"|"schedule-replacement"|"partial-refund"|"full-refund"|"escalate-human",',
  "rationale:string<=2000, evidenceRefs:string[<=20], proposedAmountMinor:int>=0|null,",
  'confidence:"low"|"medium"|"high", risks:string[<=20], requiredApprovals:string[<=10].',
].join(" ");

export interface CitableEvidence {
  id: string;
  summary: string;
}

function heuristicIntent(rawText: string, nowMs: number): IntentAnalysis {
  const parsed = parseIntentText(rawText, nowMs);
  return {
    quantity: parsed.quantity,
    budgetMinor: parsed.budgetMinor,
    currency: parsed.budgetMinor === null ? null : parsed.currency,
    productType: parsed.categories[0] ?? null,
    deadlineDays: parsed.deadlineDays,
    requirements: parsed.mandatory,
    ambiguities: parsed.notes,
    tradeoffs: [],
  };
}

export async function analyzeIntentText(
  service: AIService,
  rawText: string,
  buyerId: string,
  nowMs: number,
): Promise<{
  constraints: {
    quantity: number;
    budgetMinor: number | null;
    currency: string | null;
    productType: string | null;
    deadlineDays: number | null;
  };
  requirements: string[];
  ambiguities: string[];
  tradeoffs: string[];
  injection: { matched: boolean; signals: string[] };
  origin: string;
  provenance: unknown;
}> {
  const injection = scanInjection(rawText);
  const result = await service.generateWithFallback(
    {
      task: "purchase-intelligence",
      system: `${INTENT_SYSTEM} ${INTENT_OUTPUT_FIELDS}`,
      user: { rawText: rawText.slice(0, 4000), buyerId },
      schema: IntentAnalysisSchema,
      schemaName: "IntentAnalysis",
    },
    () => heuristicIntent(rawText, nowMs),
  );
  return {
    constraints: {
      quantity: result.data.quantity,
      budgetMinor: result.data.budgetMinor,
      currency: result.data.currency,
      productType: result.data.productType,
      deadlineDays: result.data.deadlineDays,
    },
    requirements: result.data.requirements,
    ambiguities: result.data.ambiguities,
    tradeoffs: result.data.tradeoffs,
    injection,
    origin: result.provenance.fallbackUsed ? "heuristic-parse" : `ai-model:${result.provenance.modelServed}`,
    provenance: result.provenance,
  };
}

export async function analyzeIncidentForPromise(
  service: AIService,
  promise: PurchasePromise,
  observation: Observation,
  citable: CitableEvidence[],
): Promise<{
  gaps: { category: string; severity: string; detail: string }[];
  interpretation: string;
  citations: string[];
  droppedCitations: string[];
  uncertainty: string;
  escalate: boolean;
  origin: string;
  provenance: unknown;
}> {
  const gaps = detectGaps(promise, observation);
  const totalMinor = promise.items.reduce((n, item) => n + item.unitPrice.amountMinor * item.quantity, 0);
  const fallback = (): IncidentAnalysis => ({
    category: gaps[0]?.category ?? "other",
    interpretation:
      gaps.length === 0
        ? "Deterministic comparison found no gap between promise and observation."
        : `Deterministic detection found ${gaps.length} gap(s): ${gaps.map((g) => `${g.category} (${g.detail})`).join("; ")}.`,
    evidenceRefs: citable.map((c) => c.id),
    missingInfo: [],
    uncertainty: gaps.length === 0 ? "high" : "low",
    escalate: false,
  });
  const result = await service.generateWithFallback(
    {
      task: "incident-intelligence",
      system: `${INCIDENT_SYSTEM} ${INCIDENT_OUTPUT_FIELDS}`,
      user: {
        promise: { id: promise.id, totalMinor, currency: promise.total.currency, items: promise.items },
        observation,
        detectedGaps: gaps,
        citableEvidence: citable,
      },
      schema: IncidentAnalysisSchema,
      schemaName: "IncidentAnalysis",
    },
    fallback,
  );
  let analysis = result.data;
  if (!result.provenance.fallbackUsed) {
    const gate = gateIncidentCategory(analysis.category, gaps);
    if (!gate.accepted) {
      analysis = fallback();
    }
  }
  const refs = verifyEvidenceRefs(
    analysis.evidenceRefs,
    citable.map((c) => c.id),
  );
  return {
    gaps: gaps.map((g) => ({ category: g.category, severity: g.severity, detail: g.detail })),
    interpretation: analysis.interpretation,
    citations: refs.kept,
    droppedCitations: refs.dropped,
    uncertainty: analysis.uncertainty,
    escalate: analysis.escalate,
    origin: result.provenance.fallbackUsed ? "deterministic-detection" : `ai-model:${result.provenance.modelServed}`,
    provenance: result.provenance,
  };
}

export async function planRecoveryForIncident(
  service: AIService,
  incident: Incident,
  promise: PurchasePromise,
  bounds: { remainingMinor: number; currency: string },
): Promise<{
  strategy: string;
  rationale: string;
  amountMinor: number | null;
  confidence: string;
  risks: string[];
  requiredApprovals: string[];
  gate: { verdict: RecoveryGateVerdict; reason: string };
  executed: false;
  origin: string;
  provenance: unknown;
}> {
  const fallback = (): RecoveryPlan => ({
    strategy: "partial-refund",
    rationale: `Deterministic fallback for ${incident.category}: operator must size the refund to the missing share; bounded by remaining ${bounds.remainingMinor} ${bounds.currency}.`,
    evidenceRefs: [],
    proposedAmountMinor: bounds.remainingMinor,
    confidence: "low",
    risks: ["Fallback cannot size the missing share; operator review required."],
    requiredApprovals: ["merchant-operator"],
  });
  const result = await service.generateWithFallback(
    {
      task: "recovery-planning",
      system: `${RECOVERY_SYSTEM} ${RECOVERY_OUTPUT_FIELDS}`,
      user: {
        incident: { id: incident.id, category: incident.category, severity: incident.severity, detail: incident.detail },
        promise: { id: promise.id, currency: promise.total.currency },
        remainingMinor: bounds.remainingMinor,
        currency: bounds.currency,
      },
      schema: RecoveryPlanSchema,
      schemaName: "RecoveryPlan",
    },
    fallback,
  );
  const gate = gateRecoveryAmount(result.data.proposedAmountMinor, bounds.remainingMinor, bounds.currency);
  return {
    strategy: result.data.strategy,
    rationale: result.data.rationale,
    amountMinor: gate.amountMinor,
    confidence: result.data.confidence,
    risks: result.data.risks,
    requiredApprovals:
      result.data.requiredApprovals.length > 0 ? result.data.requiredApprovals : ["merchant-operator"],
    gate: { verdict: gate.verdict, reason: gate.reason },
    executed: false,
    origin: result.provenance.fallbackUsed ? "deterministic-template" : `ai-model:${result.provenance.modelServed}`,
    provenance: result.provenance,
  };
}
