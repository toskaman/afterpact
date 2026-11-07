import { z } from "zod";

export const OutcomeKindSchema = z.enum([
  "delivery-scan",
  "tracking-update",
  "buyer-confirmation",
  "provider-webhook",
  "sensor",
  "manual",
]);
export type OutcomeKind = z.infer<typeof OutcomeKindSchema>;

/** Where an observation came from; every outcome must cite provenance. */
export const ProvenanceSchema = z.object({
  source: z.string().min(1).max(200),
  sourceId: z.string().min(1).max(500).optional(),
  fetchedAt: z.iso.datetime().optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

const ConfidenceSchema = z.number().min(0).max(1);

/** One observed fact about the purchase outcome (delivery, charge, ...). */
export const OutcomeEventSchema = z.object({
  id: z.string().min(1),
  promiseId: z.string().min(1),
  kind: OutcomeKindSchema,
  observedAt: z.iso.datetime(),
  summary: z.string().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).default({}),
  provenance: ProvenanceSchema,
  confidence: ConfidenceSchema,
});
export type OutcomeEvent = z.infer<typeof OutcomeEventSchema>;

/** Durable, content-addressed evidence bundle backing outcomes/incidents. */
export const EvidenceSchema = z.object({
  id: z.string().min(1),
  promiseId: z.string().min(1),
  outcomeEventIds: z.array(z.string().min(1)).default([]),
  type: z.string().min(1).max(200),
  uri: z.string().url().optional(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  collectedAt: z.iso.datetime(),
  provenance: ProvenanceSchema,
  confidence: ConfidenceSchema,
});
export type Evidence = z.infer<typeof EvidenceSchema>;
