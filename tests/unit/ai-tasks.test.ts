import { describe, expect, it } from "vitest";
import {
  AIService,
  type AIProvider,
  type AIProvenance,
  type StructuredAIRequest,
  type StructuredAIResult,
} from "../../packages/ai/src/index";
import { createPromise } from "../../packages/domain/src/index";
import type { Incident } from "../../packages/domain/src/index";
import {
  analyzeIncidentForPromise,
  analyzeIntentText,
  gateIncidentCategory,
  gateRecoveryAmount,
  INCIDENT_OUTPUT_FIELDS,
  INTENT_OUTPUT_FIELDS,
  IntentAnalysisSchema,
  planRecoveryForIncident,
  RECOVERY_OUTPUT_FIELDS,
  RecoveryPlanSchema,
  verifyEvidenceRefs,
} from "../../apps/api/src/aiTasks";

describe("verifyEvidenceRefs", () => {
  it("keeps cited ids that exist and reports dropped hallucinations", () => {
    const result = verifyEvidenceRefs(["ev-1", "ev-nope", "ev-2", "ev-1"], ["ev-1", "ev-2"]);
    expect(result.kept).toEqual(["ev-1", "ev-2"]);
    expect(result.dropped).toEqual(["ev-nope"]);
  });
});

describe("gateIncidentCategory", () => {
  it("accepts a model category backed by deterministic detection", () => {
    const gaps = [{ category: "not-delivered", severity: "high", detail: "ordered 3, got 2" }];
    expect(gateIncidentCategory("not-delivered", gaps).accepted).toBe(true);
  });

  it("rejects a model category with no detected gap", () => {
    const gaps = [{ category: "not-delivered", severity: "high", detail: "ordered 3, got 2" }];
    const result = gateIncidentCategory("merchant-fraud", gaps);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("not-delivered");
  });
});

describe("gateRecoveryAmount", () => {
  it("approves in-bounds proposals as-is", () => {
    const result = gateRecoveryAmount(12999, 38997, "USD");
    expect(result.verdict).toBe("approved-as-proposed");
    expect(result.amountMinor).toBe(12999);
  });

  it("refuses over-limit proposals instead of silently clamping money", () => {
    const result = gateRecoveryAmount(99999, 38997, "USD");
    expect(result.verdict).toBe("refused");
    expect(result.amountMinor).toBeNull();
    expect(result.reason).toContain("38997");
  });

  it("routes null proposals to a human", () => {
    const result = gateRecoveryAmount(null, 38997, "USD");
    expect(result.verdict).toBe("needs-human");
  });
});

const STUB_PROVENANCE: AIProvenance = {
  providerId: "stub",
  modelRequested: "stub-model",
  modelServed: "stub-model",
  seed: null,
  promptTokens: 1,
  completionTokens: 1,
  costUsd: 0,
  latencyMs: 1,
  attempts: 1,
  fallbackUsed: false,
  fallbackReason: null,
  validatedAt: "2026-01-01T00:00:00.000Z",
};

function stubService<T>(data: T): { service: AIService; systems: string[] } {
  const systems: string[] = [];
  const provider: AIProvider = {
    id: "stub",
    model: "stub-model",
    generateStructured: async <U>(request: StructuredAIRequest<U>): Promise<StructuredAIResult<U>> => {
      systems.push(request.system);
      return { data: data as unknown as U, provenance: { ...STUB_PROVENANCE } };
    },
  };
  return { service: new AIService(provider), systems };
}

function testPromise(): ReturnType<typeof createPromise> {
  return createPromise({
    id: "prom-test",
    intentId: "intent-test",
    offerId: "offer-test",
    buyerId: "buyer-test",
    merchantId: "merchant-test",
    total: { currency: "USD", amountMinor: 12999 },
    items: [{ name: "field sensor kit", quantity: 3, unitPrice: { currency: "USD", amountMinor: 4333 } }],
    expectedDeliveryDate: "2026-02-01T00:00:00.000Z",
    validUntil: "2026-03-01T00:00:00.000Z",
    tolerances: { maxDelayDays: 2, maxPriceDriftBps: 100 },
    evidenceRequirements: [],
    resolutionPolicy: { autoRefundOnMiss: false, maxAutoRefundBps: 10000, requireBuyerApproval: true },
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("AI task prompts name their exact output keys", () => {
  it("intent prompt names every IntentAnalysis key", async () => {
    const { service, systems } = stubService({
      quantity: 2,
      budgetMinor: 40000,
      currency: "USD",
      productType: "sensors",
      deadlineDays: 10,
      requirements: [],
      ambiguities: [],
      tradeoffs: [],
    });
    await analyzeIntentText(service, "Buy two sensor kits under $400", "b", Date.now());
    expect(systems).toHaveLength(1);
    for (const key of ["quantity", "budgetMinor", "currency", "productType", "deadlineDays", "requirements", "ambiguities", "tradeoffs"]) {
      expect(systems[0]).toContain(key);
    }
    expect(INTENT_OUTPUT_FIELDS).toContain("budgetMinor");
    expect(INTENT_OUTPUT_FIELDS).toContain("$=USD");
  });

  it("incident prompt names every IncidentAnalysis key", async () => {
    const { service, systems } = stubService({
      category: "not-delivered",
      interpretation: "stub",
      evidenceRefs: [],
      missingInfo: [],
      uncertainty: "low",
      escalate: false,
    });
    await analyzeIncidentForPromise(service, testPromise(), { deliveredQuantity: 2 }, []);
    expect(systems).toHaveLength(1);
    for (const key of ["category", "interpretation", "evidenceRefs", "missingInfo", "uncertainty", "escalate"]) {
      expect(systems[0]).toContain(key);
    }
    expect(INCIDENT_OUTPUT_FIELDS).toContain("evidenceRefs");
  });

  it("recovery prompt names every RecoveryPlan key", async () => {
    const promise = testPromise();
    const incident: Incident = {
      id: "inc-test",
      promiseId: promise.id,
      detectedAt: "2026-01-02T00:00:00.000Z",
      detectedBy: "policy",
      category: "not-delivered",
      detail: "ordered 3, got 2",
      severity: "high",
      status: "open",
      linkedOutcomeEventIds: [],
      linkedEvidenceIds: [],
    };
    const { service, systems } = stubService({
      strategy: "partial-refund",
      rationale: "stub",
      evidenceRefs: [],
      proposedAmountMinor: 100,
      confidence: "medium",
      risks: [],
      requiredApprovals: ["merchant-operator"],
    });
    await planRecoveryForIncident(service, incident, promise, { remainingMinor: 1000, currency: "USD" });
    expect(systems).toHaveLength(1);
    for (const key of ["strategy", "rationale", "evidenceRefs", "proposedAmountMinor", "confidence", "risks", "requiredApprovals"]) {
      expect(systems[0]).toContain(key);
    }
    expect(RECOVERY_OUTPUT_FIELDS).toContain("proposedAmountMinor");
  });
});

describe("AI tasks re-validate provider output", () => {
  it("intent falls back when a misbehaving provider returns malformed data", async () => {
    const { service } = stubService({ quantity: "three", budgetMinor: "lots" });
    const result = await analyzeIntentText(service, "Buy sensor kits under $400", "b", Date.now());
    expect(result.origin).toBe("heuristic-parse");
    expect(result.constraints.budgetMinor).toBe(40000);
    expect(result.constraints.currency).toBe("USD");
  });

  it("incident falls back and reports no gate trip on malformed data", async () => {
    const { service } = stubService({ category: 42 });
    const result = await analyzeIncidentForPromise(service, testPromise(), { deliveredQuantity: 2 }, []);
    expect(result.origin).toBe("deterministic-detection");
    expect(result.category).toBe("not-delivered");
    expect(result.categoryGated).toBe(false);
  });

  it("recovery falls back to the bounded template on malformed data", async () => {
    const promise = testPromise();
    const { service } = stubService({ strategy: "print-money", proposedAmountMinor: -1 });
    const incident: Incident = {
      id: "inc-test",
      promiseId: promise.id,
      detectedAt: "2026-01-02T00:00:00.000Z",
      detectedBy: "policy",
      category: "not-delivered",
      detail: "ordered 3, got 2",
      severity: "high",
      status: "open",
      linkedOutcomeEventIds: [],
      linkedEvidenceIds: [],
    };
    const result = await planRecoveryForIncident(service, incident, promise, { remainingMinor: 4333, currency: "USD" });
    expect(result.origin).toBe("deterministic-template");
    expect(result.strategy).toBe("partial-refund");
    expect(result.amountMinor).toBe(4333);
    expect(result.executed).toBe(false);
  });
});

describe("AI task schemas", () => {
  it("rejects intent analysis with a malformed currency", () => {
    const parsed = IntentAnalysisSchema.safeParse({
      quantity: 3,
      budgetMinor: 50000,
      currency: "dollars",
      productType: "sensors",
      deadlineDays: 14,
      requirements: [],
      ambiguities: [],
      tradeoffs: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects recovery plans with negative amounts", () => {
    const parsed = RecoveryPlanSchema.safeParse({
      strategy: "partial-refund",
      rationale: "x",
      evidenceRefs: [],
      proposedAmountMinor: -5,
      confidence: "high",
      risks: [],
      requiredApprovals: ["merchant-operator"],
    });
    expect(parsed.success).toBe(false);
  });
});
