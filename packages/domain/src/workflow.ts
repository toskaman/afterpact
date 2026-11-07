import { z } from "zod";
import { IdempotencyKeySchema } from "./idempotency";

export const WorkflowNameSchema = z.enum(["purchase", "monitor", "resolve"]);
export type WorkflowName = z.infer<typeof WorkflowNameSchema>;

export const WorkflowStatusSchema = z.enum([
  "pending",
  "running",
  "waiting-approval",
  "completed",
  "failed",
  "canceled",
  "timed-out",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowStepStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

export const WorkflowStepSchema = z.object({
  name: z.string().min(1),
  status: WorkflowStepStatusSchema,
  attempts: z.number().int().min(0).default(0),
  lastError: z.string().max(2000).optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/** Durable multi-step execution (local runner now; Render Workflows seam later). */
export const WorkflowExecutionSchema = z.object({
  id: z.string().min(1),
  workflow: WorkflowNameSchema,
  promiseId: z.string().min(1).optional(),
  status: WorkflowStatusSchema,
  currentStep: z.string().min(1).optional(),
  steps: z.array(WorkflowStepSchema).default([]),
  idempotencyKey: IdempotencyKeySchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;
