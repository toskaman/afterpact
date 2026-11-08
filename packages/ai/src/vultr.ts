import {
  AIConfigError,
  AIInvalidOutputError,
  AIModelMismatchError,
  AITimeoutError,
  AITransportError,
} from "./errors";
import type {
  AIProvider,
  ChatRequest,
  ChatResult,
  ChatToolCallInput,
  PriceTable,
  StructuredAIRequest,
  StructuredAIResult,
} from "./types";

export const VULTR_DEFAULT_MODEL = "deepseek-v4.1-flash-1017";
export const VULTR_DEFAULT_BASE_URL = "https://api.vultrinference.com";

/** Live catalog prices 2026-11-07 (USD/MTok). Override per model as needed. */
export const VULTR_DEFAULT_PRICES: PriceTable = {
  promptPerMTok: 0.15,
  completionPerMTok: 0.6,
};

export interface VultrInferenceConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  seed: number | null;
  /** Default minimal: without it the model can burn the token budget on reasoning. */
  reasoningEffort: string;
  prices: PriceTable;
}

export function vultrConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { config: VultrInferenceConfig; hasKey: boolean } {
  const apiKey = env["VULTR_INFERENCE_API_KEY"] ?? "";
  const timeoutMs = Number.parseInt(env["AI_TIMEOUT_MS"] ?? "30000", 10);
  const maxTokens = Number.parseInt(env["AI_MAX_TOKENS"] ?? "1024", 10);
  const seedRaw = env["AI_SEED"];
  return {
    hasKey: apiKey !== "",
    config: {
      apiKey,
      model: env["VULTR_INFERENCE_MODEL"] ?? VULTR_DEFAULT_MODEL,
      baseUrl: env["VULTR_INFERENCE_BASE_URL"] ?? VULTR_DEFAULT_BASE_URL,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
      maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1024,
      temperature: 0,
      seed: seedRaw === undefined || seedRaw === "" ? null : Number.parseInt(seedRaw, 10),
      reasoningEffort: env["AI_REASONING_EFFORT"] ?? "minimal",
      prices: VULTR_DEFAULT_PRICES,
    },
  };
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/** Compact one-line summary of validation issues for error messages. */
export function summarizeIssues(issues: unknown): string {
  if (!Array.isArray(issues)) return "";
  const parts: string[] = [];
  for (const issue of issues.slice(0, 3)) {
    if (typeof issue !== "object" || issue === null) continue;
    const record = issue as Record<string, unknown>;
    const path = Array.isArray(record["path"]) ? record["path"].join(".") : "";
    const message = typeof record["message"] === "string" ? record["message"] : "invalid";
    parts.push(path === "" ? message : `${path}: ${message}`);
  }
  const joined = parts.join("; ");
  return joined.length > 300 ? `${joined.slice(0, 297)}…` : joined;
}

interface ChatCompletionsWire {
  model?: unknown;
  choices?: unknown;
  usage?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function usageOf(json: ChatCompletionsWire): { prompt: number; completion: number } {
  const usage = asRecord(json.usage);
  const prompt = usage !== null ? usage["prompt_tokens"] : undefined;
  const completion = usage !== null ? usage["completion_tokens"] : undefined;
  return {
    prompt: typeof prompt === "number" && prompt >= 0 ? prompt : 0,
    completion: typeof completion === "number" && completion >= 0 ? completion : 0,
  };
}

function contentOf(json: ChatCompletionsWire): string {
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const first = choices.length > 0 ? asRecord(choices[0]) : null;
  const message = first !== null ? asRecord(first["message"]) : null;
  const content = message !== null ? message["content"] : undefined;
  if (typeof content !== "string" || content === "") {
    throw new AITransportError("provider returned no message content", 200, {
      hasChoices: choices.length > 0,
    });
  }
  return content;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new SyntaxError("no JSON object found in model output");
  }
}

export class VultrInferenceProvider implements AIProvider {
  readonly id = "vultr-inference";
  readonly model: string;
  private readonly fetchFn: FetchFn;
  private readonly config: VultrInferenceConfig;

  constructor(config: VultrInferenceConfig, fetchFn?: FetchFn) {
    if (config.apiKey === "") {
      throw new AIConfigError("VULTR_INFERENCE_API_KEY is empty");
    }
    this.config = config;
    this.model = config.model;
    this.fetchFn = fetchFn ?? ((url, init) => fetch(url, init));
  }

  /**
   * Raw chat turn with optional tools. Single attempt (the caller owns any
   * retry loop), same identity/timeout/cost discipline as structured calls.
   * Used by the AG Studio agent proxy; never exposes the API key.
   */
  async chat(request: ChatRequest): Promise<ChatResult> {
    const started = Date.now();
    const timeoutMs = request.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const toolChoice =
        request.toolChoice === undefined
          ? undefined
          : typeof request.toolChoice === "string"
            ? request.toolChoice
            : { type: "function", function: { name: request.toolChoice.name } };
      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.toolCalls === undefined ? {} : { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })) }),
          ...(m.toolCallId === undefined ? {} : { tool_call_id: m.toolCallId }),
        })),
        ...(request.tools === undefined ? {} : { tools: request.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }),
        ...(toolChoice === undefined ? {} : { tool_choice: toolChoice }),
        ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        reasoning_effort: this.config.reasoningEffort,
      };
      let response: Response;
      try {
        response = await this.fetchFn(`${this.config.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") throw new AITimeoutError(timeoutMs);
        throw new AITransportError(error instanceof Error ? error.message : "fetch failed", null);
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AITransportError(`provider HTTP ${response.status}`, response.status, { bodyHead: detail.slice(0, 300) });
      }
      const json = (await response.json()) as ChatCompletionsWire;
      const served = typeof json.model === "string" ? json.model : "";
      if (served !== "" && served !== this.config.model) {
        throw new AIModelMismatchError(this.config.model, served);
      }
      const choices = Array.isArray(json.choices) ? json.choices : [];
      const message = choices.length > 0 ? asRecord(asRecord(choices[0])?.["message"]) : null;
      const content = message?.["content"];
      const text = typeof content === "string" ? content : "";
      const rawCalls = message !== null && Array.isArray(message["tool_calls"]) ? (message["tool_calls"] as unknown[]) : [];
      const toolCalls: ChatToolCallInput[] = [];
      for (const raw of rawCalls) {
        const fn = asRecord(asRecord(raw)?.["function"]);
        const id = asRecord(raw)?.["id"];
        if (typeof id !== "string" || fn === null || typeof fn["name"] !== "string" || typeof fn["arguments"] !== "string") continue;
        toolCalls.push({ id, name: fn["name"], arguments: fn["arguments"] });
      }
      if (text === "" && toolCalls.length === 0) {
        throw new AITransportError("provider returned neither content nor tool calls", 200, { hasChoices: choices.length > 0 });
      }
      const usage = usageOf(json);
      const finish = asRecord(choices[0])?.["finish_reason"];
      return {
        content: text,
        toolCalls,
        finishReason: typeof finish === "string" ? finish : null,
        usage: { prompt: usage.prompt, completion: usage.completion },
        costUsd: (usage.prompt * this.config.prices.promptPerMTok + usage.completion * this.config.prices.completionPerMTok) / 1_000_000,
        modelServed: served === "" ? this.config.model : served,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async generateStructured<T>(
    request: StructuredAIRequest<T>,
  ): Promise<StructuredAIResult<T>> {
    const started = Date.now();
    const maxAttempts = request.maxAttempts ?? 2;
    const timeoutMs = request.timeoutMs ?? this.config.timeoutMs;
    const maxTokens = request.maxTokens ?? this.config.maxTokens;
    const temperature = request.temperature ?? this.config.temperature;
    const seed = request.seed ?? this.config.seed;
    const reasoningEffort = request.reasoningEffort ?? this.config.reasoningEffort;
    let lastIssues: unknown = null;
    let lastOutputHead: string | null = null;
    let totalPrompt = 0;
    let totalCompletion = 0;
    let attempts = 0;

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
      attempts = attempt;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const userContent =
          attempt === 1
            ? JSON.stringify(request.user)
            : JSON.stringify({ input: request.user, previousIssues: lastIssues });
        const body: Record<string, unknown> = {
          model: this.config.model,
          messages: [
            {
              role: "system",
              content:
                attempt === 1
                  ? `${request.system}\nReturn ONLY a JSON object matching schema "${request.schemaName}". No prose, no markdown fences.`
                  : `${request.system}\nYour previous output failed validation: ${JSON.stringify(lastIssues)}. Return ONLY a corrected JSON object matching schema "${request.schemaName}".`,
            },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
          reasoning_effort: reasoningEffort,
          ...(seed === null || Number.isNaN(seed) ? {} : { seed }),
        };
        let response: Response;
        try {
          response = await this.fetchFn(
            `${this.config.baseUrl}/v1/chat/completions`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.config.apiKey}`,
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            },
          );
        } catch (error: unknown) {
          if (error instanceof Error && error.name === "AbortError") {
            throw new AITimeoutError(timeoutMs);
          }
          throw new AITransportError(
            error instanceof Error ? error.message : "fetch failed",
            null,
          );
        } finally {
          clearTimeout(timer);
        }
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new AITransportError(
            `provider HTTP ${response.status}`,
            response.status,
            { bodyHead: detail.slice(0, 300) },
          );
        }
        const json = (await response.json()) as ChatCompletionsWire;
        const served = typeof json.model === "string" ? json.model : "";
        if (served !== "" && served !== this.config.model) {
          throw new AIModelMismatchError(this.config.model, served);
        }
        const usage = usageOf(json);
        totalPrompt += usage.prompt;
        totalCompletion += usage.completion;
        let parsed: unknown;
        try {
          const raw = contentOf(json);
          lastOutputHead = raw.slice(0, 300);
          parsed = extractJson(raw);
        } catch {
          lastIssues = [{ path: [], message: "output was not valid JSON" }];
          continue;
        }
        const checked = request.schema.safeParse(parsed);
        if (checked.success) {
          return {
            data: checked.data,
            provenance: this.provenance(request, {
              served: served === "" ? this.config.model : served,
              seed,
              promptTokens: totalPrompt,
              completionTokens: totalCompletion,
              latencyMs: Date.now() - started,
              attempts,
            }),
          };
        }
        lastIssues = checked.error.issues;
      } finally {
        clearTimeout(timer);
      }
    }
    const summary = summarizeIssues(lastIssues);
    throw new AIInvalidOutputError(
      `model output failed schema "${request.schemaName}" after ${attempts} attempt(s)${summary === "" ? "" : `: ${summary}`}`,
      lastIssues,
      attempts,
      lastOutputHead,
    );
  }

  private provenance(
    request: StructuredAIRequest<unknown>,
    sample: {
      served: string;
      seed: number | null;
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
      attempts: number;
    },
  ): StructuredAIResult<unknown>["provenance"] {
    void request;
    const costUsd =
      (sample.promptTokens * this.config.prices.promptPerMTok +
        sample.completionTokens * this.config.prices.completionPerMTok) /
      1_000_000;
    return {
      providerId: this.id,
      modelRequested: this.config.model,
      modelServed: sample.served,
      seed: sample.seed,
      promptTokens: sample.promptTokens,
      completionTokens: sample.completionTokens,
      costUsd,
      latencyMs: sample.latencyMs,
      attempts: sample.attempts,
      fallbackUsed: false,
      fallbackReason: null,
      validatedAt: new Date().toISOString(),
    };
  }
}
