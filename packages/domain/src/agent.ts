import { z } from "zod";

export const AgentKindSchema = z.enum([
  "intent-extract",
  "offer-rank",
  "outcome-watch",
  "incident-triage",
  "resolution-draft",
]);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const AgentRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

/** One bounded AI/agent execution, with content hashes for auditability. */
export const AgentRunSchema = z.object({
  id: z.string().min(1),
  kind: AgentKindSchema,
  promiseId: z.string().min(1).optional(),
  status: AgentRunStatusSchema,
  model: z.string().min(1).max(200).optional(),
  attempt: z.number().int().min(1).default(1),
  inputHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  outputHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  error: z.string().max(2000).optional(),
  queuedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().optional(),
  finishedAt: z.iso.datetime().optional(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;
