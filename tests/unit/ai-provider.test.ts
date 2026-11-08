import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AIInvalidOutputError,
  AIModelMismatchError,
  AINotConfiguredError,
  AITimeoutError,
  AITransportError,
  AIService,
  VultrInferenceProvider,
  type StructuredAIRequest,
} from "../../packages/ai/src/index";

const MODEL = "deepseek-v4.1-flash-1017";
const Output = z.object({ summary: z.string(), score: z.number() });

function baseConfig() {
  return {
    apiKey: "test-key",
    model: MODEL,
    baseUrl: "https://unit.test",
    timeoutMs: 1000,
    maxTokens: 64,
    temperature: 0,
    seed: null,
    reasoningEffort: "minimal",
    prices: { promptPerMTok: 0.15, completionPerMTok: 0.6 },
  };
}

function request(overrides: Partial<StructuredAIRequest<{ summary: string; score: number }>> = {}) {
  return {
    task: "incident-intelligence" as const,
    system: "Summarize.",
    user: { text: "hello" },
    schema: Output,
    schemaName: "Summary",
    ...overrides,
  };
}

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completion(content: string, model = MODEL, usage = { prompt_tokens: 10, completion_tokens: 5 }) {
  return { model, choices: [{ message: { content } }], usage };
}

describe("VultrInferenceProvider (stubbed fetch)", () => {
  it("returns validated data with exact cost provenance", async () => {
    let sentInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      sentInit = init;
      return okJson(completion(JSON.stringify({ summary: "ok", score: 3 })));
    });
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const result = await provider.generateStructured(request());
    expect(result.data).toEqual({ summary: "ok", score: 3 });
    expect(result.provenance.modelServed).toBe(MODEL);
    expect(result.provenance.fallbackUsed).toBe(false);
    expect(result.provenance.attempts).toBe(1);
    // (10 * 0.15 + 5 * 0.6) / 1e6
    expect(result.provenance.costUsd).toBeCloseTo(0.0000045, 12);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((sentInit?.body ?? "{}") as string) as Record<string, unknown>;
    expect(sentBody["reasoning_effort"]).toBe("minimal");
    expect(sentBody["model"]).toBe(MODEL);
  });

  it("refuses silently substituted models", async () => {
    const fetchFn = vi.fn(async () =>
      okJson(completion(JSON.stringify({ summary: "ok", score: 1 }), "some-other-model")),
    );
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    await expect(provider.generateStructured(request())).rejects.toBeInstanceOf(AIModelMismatchError);
  });

  it("repairs invalid output once, then fails with issues", async () => {
    const fetchFn = vi
      .fn(async () => okJson(completion(JSON.stringify({ summary: "x" }))))
      .mockResolvedValueOnce(okJson(completion("not json at all")));
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const error = await provider.generateStructured(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AIInvalidOutputError);
    expect((error as AIInvalidOutputError).attempts).toBe(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("preserves the raw output head on the invalid-output error", async () => {
    const fetchFn = vi.fn(async () => okJson(completion("not json at all, just prose")));
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const error = await provider.generateStructured(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AIInvalidOutputError);
    expect((error as AIInvalidOutputError).outputHead).toContain("not json at all");
  });

  it("names the failing field in the invalid-output message", async () => {
    const fetchFn = vi.fn(async () => okJson(completion(JSON.stringify({ summary: "x" }))));
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const error = await provider.generateStructured(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AIInvalidOutputError);
    expect((error as Error).message).toContain("score");
  });

  it("repairs and succeeds on the second attempt", async () => {
    const fetchFn = vi
      .fn(async () => okJson(completion(JSON.stringify({ summary: "fixed", score: 9 }))))
      .mockResolvedValueOnce(okJson(completion("garbage")));
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const result = await provider.generateStructured(request());
    expect(result.data).toEqual({ summary: "fixed", score: 9 });
    expect(result.provenance.attempts).toBe(2);
  });

  it("chats back plain text with usage", async () => {
    const fetchFn = vi.fn(async () =>
      okJson({ model: MODEL, choices: [{ message: { content: "hello", tool_calls: [] }, finish_reason: "stop" }], usage: { prompt_tokens: 8, completion_tokens: 3 } }),
    );
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const result = await provider.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(result.content).toBe("hello");
    expect(result.toolCalls).toEqual([]);
    expect(result.usage).toEqual({ prompt: 8, completion: 3 });
    expect(result.modelServed).toBe(MODEL);
  });

  it("chats back tool calls for agentic turns", async () => {
    let sentInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      sentInit = init;
      return okJson({
        model: MODEL,
        choices: [{
          message: {
            content: null,
            tool_calls: [{ id: "call_1", type: "function", function: { name: "addWidget", arguments: "{\"type\":\"bar\"}" } }],
          },
          finish_reason: "tool_calls",
        }],
        usage: { prompt_tokens: 40, completion_tokens: 12 },
      });
    });
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    const result = await provider.chat({
      messages: [{ role: "user", content: "chart it" }],
      tools: [{ name: "addWidget", description: "add a widget", parameters: { type: "object" } }],
      toolChoice: "auto",
    });
    expect(result.toolCalls).toEqual([{ id: "call_1", name: "addWidget", arguments: "{\"type\":\"bar\"}" }]);
    expect(result.finishReason).toBe("tool_calls");
    const sentBody = JSON.parse((sentInit?.body ?? "{}") as string) as Record<string, unknown>;
    expect(sentBody["tools"]).toEqual([{ type: "function", function: { name: "addWidget", description: "add a widget", parameters: { type: "object" } } }]);
  });

  it("rejects empty replies with no tool calls", async () => {
    const fetchFn = vi.fn(async () =>
      okJson({ model: MODEL, choices: [{ message: { content: "", tool_calls: [] }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 0 } }),
    );
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    await expect(provider.chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toBeInstanceOf(AITransportError);
  });

  it("times out hung providers", async () => {
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const provider = new VultrInferenceProvider(baseConfig(), fetchFn);
    await expect(provider.generateStructured(request({ timeoutMs: 30 }))).rejects.toBeInstanceOf(
      AITimeoutError,
    );
  });
});

describe("AIService fallback + ledger", () => {
  it("falls back deterministically and records provenance", async () => {
    const failing = new VultrInferenceProvider(
      baseConfig(),
      vi.fn(async () => {
        throw new Error("provider down");
      }),
    );
    const service = new AIService(failing);
    const result = await service.generateWithFallback(request(), () => ({ summary: "fb", score: 0 }));
    expect(result.data).toEqual({ summary: "fb", score: 0 });
    expect(result.provenance.fallbackUsed).toBe(true);
    expect(result.provenance.fallbackReason).toContain("provider down");
    expect(service.ledgerSummary()).toMatchObject({ calls: 1, fallbacks: 1, costUsd: 0 });
  });

  it("carries the raw output head through fallback provenance", async () => {
    const fetchFn = vi.fn(async () => okJson(completion("garbage prose, no json")));
    const service = new AIService(new VultrInferenceProvider(baseConfig(), fetchFn));
    const result = await service.generateWithFallback(request(), () => ({ summary: "fb", score: 0 }));
    expect(result.provenance.fallbackUsed).toBe(true);
    expect(result.provenance.outputHead).toContain("garbage prose");
  });

  it("records successful calls in the ledger", async () => {
    const fetchFn = vi.fn(async () =>
      okJson(completion(JSON.stringify({ summary: "ok", score: 2 }))),
    );
    const service = new AIService(new VultrInferenceProvider(baseConfig(), fetchFn));
    await service.generateWithFallback(request(), () => ({ summary: "fb", score: 0 }));
    const summary = service.ledgerSummary();
    expect(summary).toMatchObject({ calls: 1, fallbacks: 0, promptTokens: 10, completionTokens: 5 });
    expect(summary.costUsd).toBeGreaterThan(0);
  });

  it("falls back when no provider is configured", async () => {
    const service = new AIService(null);
    const result = await service.generateWithFallback(request(), () => ({ summary: "fb", score: 0 }));
    expect(result.provenance.fallbackUsed).toBe(true);
    expect(result.provenance.fallbackReason).toBe("provider-not-configured");
  });
});

describe("AIService chatTurn (strict agent turns)", () => {
  it("passes chat through and attributes cost to analytics-assistant", async () => {
    const fetchFn = vi.fn(async () =>
      okJson({ model: MODEL, choices: [{ message: { content: "done" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    );
    const service = new AIService(new VultrInferenceProvider(baseConfig(), fetchFn));
    const result = await service.chatTurn({ messages: [{ role: "user", content: "hi" }] });
    expect(result.content).toBe("done");
    expect(result.costUsd).toBeCloseTo(0.0000045, 12);
    expect(service.ledgerSummary()).toMatchObject({ calls: 1, fallbacks: 0 });
  });

  it("throws without fallback when unconfigured", async () => {
    const service = new AIService(null);
    await expect(service.chatTurn({ messages: [] })).rejects.toBeInstanceOf(AINotConfiguredError);
  });
});
