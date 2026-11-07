import { z } from "zod";

export const IncidentCategorySchema = z.enum([
  "late-delivery",
  "not-delivered",
  "wrong-item",
  "overcharge",
  "quality",
  "other",
]);
export type IncidentCategory = z.infer<typeof IncidentCategorySchema>;

export const IncidentSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatusSchema = z.enum([
  "open",
  "triaged",
  "resolving",
  "resolved",
  "dismissed",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentDetectedBySchema = z.enum([
  "policy",
  "agent",
  "buyer",
  "webhook",
]);
export type IncidentDetectedBy = z.infer<typeof IncidentDetectedBySchema>;

/** A promise-vs-outcome gap under investigation. */
export const IncidentSchema = z.object({
  id: z.string().min(1),
  promiseId: z.string().min(1),
  detectedAt: z.iso.datetime(),
  detectedBy: IncidentDetectedBySchema,
  category: IncidentCategorySchema,
  detail: z.string().min(1).max(4000),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  linkedOutcomeEventIds: z.array(z.string().min(1)).default([]),
  linkedEvidenceIds: z.array(z.string().min(1)).default([]),
});
export type Incident = z.infer<typeof IncidentSchema>;
