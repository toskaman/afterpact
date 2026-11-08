import type { z } from "zod";

/** Stable task identifiers for prompts, evals, and cost attribution. */
export type AITaskId =
  | "purchase-intelligence"
  | "offer-evaluation"
  | "incident-intelligence"
  | "recovery-planning"
  | "analytics-assistant";

export interface StructuredAIRequest<T> {
  task: AITaskId;
  /** Privileged instruction. Never built from untrusted external text. */
  system: string;
  /** Grounding payload (JSON-serializable). Treated as data, not instruction. */
  user: unknown;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  temperature?: number;
  seed?: number;
  /** Reasoning budget (Vultr: minimal|low|medium|high|xhigh|max|ultra). Default minimal. */
  reasoningEffort?: string;
  timeoutMs?: number;
  /** Total attempts including the first (default 2: try + one repair). */
  maxAttempts?: number;
}

export interface AIProvenance {
  providerId: string;
  modelRequested: string;
  /** Verified served model (mismatch throws, never silently accepted). */
  modelServed: string;
  seed: number | null;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  attempts: number;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  validatedAt: string;
}

export interface StructuredAIResult<T> {
  data: T;
  provenance: AIProvenance;
}

export interface AIProvider {
  readonly id: string;
  readonly model: string;
  generateStructured<T>(request: StructuredAIRequest<T>): Promise<StructuredAIResult<T>>;
}

export interface PriceTable {
  /** USD per million prompt tokens. */
  promptPerMTok: number;
  /** USD per million completion tokens. */
  completionPerMTok: number;
}

export interface CostLedgerEntry {
  task: AITaskId;
  providerId: string;
  modelServed: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  attempts: number;
  fallbackUsed: boolean;
  at: string;
}

export interface CostLedgerSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  fallbacks: number;
}
