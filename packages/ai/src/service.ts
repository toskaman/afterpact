import { AIError, AIInvalidOutputError, AINotConfiguredError } from "./errors";
import type {
  AIProvider,
  ChatRequest,
  ChatResult,
  CostLedgerEntry,
  CostLedgerSummary,
  StructuredAIRequest,
  StructuredAIResult,
} from "./types";

export class CostLedger {
  private entries: CostLedgerEntry[] = [];

  record(entry: CostLedgerEntry): void {
    this.entries.push(entry);
  }

  summary(): CostLedgerSummary {
    return this.entries.reduce<CostLedgerSummary>(
      (acc, e) => ({
        calls: acc.calls + 1,
        promptTokens: acc.promptTokens + e.promptTokens,
        completionTokens: acc.completionTokens + e.completionTokens,
        costUsd: acc.costUsd + e.costUsd,
        fallbacks: acc.fallbacks + (e.fallbackUsed ? 1 : 0),
      }),
      { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, fallbacks: 0 },
    );
  }

  recent(limit = 50): CostLedgerEntry[] {
    return this.entries.slice(-Math.max(1, limit));
  }
}

/**
 * Orchestrates one provider with a deterministic fallback. The fallback is
 * a pure function of the request — used on any provider failure (outage,
 * timeout, invalid output, unconfigured) so financial flows never block on
 * a model. Provenance always says which path executed.
 */
export class AIService {
  private readonly ledger = new CostLedger();

  constructor(private readonly provider: AIProvider | null) {}

  get providerId(): string | null {
    return this.provider?.id ?? null;
  }

  get model(): string | null {
    return this.provider?.model ?? null;
  }

  ledgerSummary(): CostLedgerSummary {
    return this.ledger.summary();
  }

  recentLedger(limit = 50): CostLedgerEntry[] {
    return this.ledger.recent(limit);
  }

  async generateWithFallback<T>(
    request: StructuredAIRequest<T>,
    fallback: (reason: string) => T,
  ): Promise<StructuredAIResult<T>> {
    if (this.provider === null) {
      const data = fallback("provider-not-configured");
      this.ledger.record(this.entry(request, null, true, "provider-not-configured", 0, 0, 0, 1));
      return { data, provenance: this.fallbackProvenance("provider-not-configured") };
    }
    try {
      const result = await this.provider.generateStructured(request);
      this.ledger.record(
        this.entry(
          request,
          result.provenance.modelServed,
          false,
          null,
          result.provenance.promptTokens,
          result.provenance.completionTokens,
          result.provenance.costUsd,
          result.provenance.attempts,
          result.provenance.latencyMs,
        ),
      );
      return result;
    } catch (error: unknown) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const outputHead = error instanceof AIInvalidOutputError ? error.outputHead : null;
      const data = fallback(reason);
      this.ledger.record(this.entry(request, null, true, reason, 0, 0, 0, 1));
      return { data, provenance: this.fallbackProvenance(reason, outputHead) };
    }
  }

  /** Strict variant: throws when no provider is configured or inference fails. */
  async generateStrict<T>(request: StructuredAIRequest<T>): Promise<StructuredAIResult<T>> {
    if (this.provider === null) {
      throw new AINotConfiguredError();
    }
    return this.provider.generateStructured(request);
  }

  /**
   * Strict chat turn for agentic callers (AG Studio adapter). No fallback:
   * a failed turn surfaces as an error, never as fabricated content.
   */
  async chatTurn(request: ChatRequest): Promise<ChatResult> {
    if (this.provider === null) {
      throw new AINotConfiguredError();
    }
    if (typeof this.provider.chat !== "function") {
      throw new AIError("provider does not support chat turns", "ai-unsupported", { providerId: this.provider.id });
    }
    const result = await this.provider.chat(request);
    this.ledger.record({
      task: "analytics-assistant",
      providerId: this.provider.id,
      modelServed: result.modelServed,
      promptTokens: result.usage.prompt,
      completionTokens: result.usage.completion,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      attempts: 1,
      fallbackUsed: false,
      at: new Date().toISOString(),
    });
    return result;
  }

  private entry<T>(
    request: StructuredAIRequest<T>,
    modelServed: string | null,
    fallbackUsed: boolean,
    fallbackReason: string | null,
    promptTokens: number,
    completionTokens: number,
    costUsd: number,
    attempts: number,
    latencyMs = 0,
  ): CostLedgerEntry {
    void request;
    return {
      task: request.task,
      providerId: this.provider?.id ?? "none",
      modelServed: modelServed ?? "none",
      promptTokens,
      completionTokens,
      costUsd,
      latencyMs,
      attempts,
      fallbackUsed,
      at: new Date().toISOString(),
    };
  }

  private fallbackProvenance<T>(reason: string, outputHead: string | null = null): StructuredAIResult<T>["provenance"] {
    return {
      providerId: this.provider?.id ?? "none",
      modelRequested: this.provider?.model ?? "none",
      modelServed: "none",
      seed: null,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      attempts: 0,
      fallbackUsed: true,
      fallbackReason: reason,
      validatedAt: new Date().toISOString(),
      outputHead,
    };
  }
}
