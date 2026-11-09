import { describe, expect, it } from "vitest";
import {
  studioItemsToChatMessages,
  studioToolsToChatTools,
  StudioTurnRequestSchema,
} from "../../apps/api/src/studioAgent";

describe("studioItemsToChatMessages", () => {
  it("maps user/system/assistant messages to chat roles", () => {
    const messages = studioItemsToChatMessages([
      { id: "1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "chart it" }] },
      { id: "2", kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: "on it", annotations: [] }] },
      { id: "3", kind: "input", type: "message", role: "system", status: "completed", content: [{ type: "text", text: "be brief" }] },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "chart it" },
      { role: "assistant", content: "on it" },
      { role: "system", content: "be brief" },
    ]);
  });

  it("maps tool calls and results to the tool round-trip", () => {
    const messages = studioItemsToChatMessages([
      { id: "c1", kind: "output", type: "function_call", callId: "call_1", name: "addWidget", arguments: "{\"type\":\"bar\"}" },
      { id: "r1", kind: "input", type: "function_call_output", callId: "call_1", output: "{\"ok\":true}", status: "completed" },
    ]);
    expect(messages).toEqual([
      { role: "assistant", content: null, toolCalls: [{ id: "call_1", name: "addWidget", arguments: "{\"type\":\"bar\"}" }] },
      { role: "tool", content: "{\"ok\":true}", toolCallId: "call_1" },
    ]);
  });

  it("skips reasoning and unknown shapes instead of guessing", () => {
    const messages = studioItemsToChatMessages([
      { id: "x", kind: "output", type: "reasoning", summary: [{ type: "summary", text: "hmm" }] },
      { id: "y", kind: "input", type: "future-kind", role: "user" },
      null,
      "nope",
      { id: "z", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "go" }] },
    ]);
    expect(messages).toEqual([{ role: "user", content: "go" }]);
  });

  it("caps history depth and text length", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`, kind: "input", type: "message", role: "user", status: "completed",
      content: [{ type: "text", text: `msg${i} ${"x".repeat(33000)}` }],
    }));
    const messages = studioItemsToChatMessages(items);
    expect(messages).toHaveLength(40);
    expect(messages[0]?.content).toContain("msg10");
    expect((messages[0]?.content ?? "").length).toBeLessThanOrEqual(32000);
  });
});

describe("studioToolsToChatTools", () => {
  it("forwards client tools and drops provider-hosted ones", () => {
    const tools = studioToolsToChatTools([
      { name: "addWidget", description: "add", parameters: { type: "object" }, kind: "client" },
      { name: "query", description: "q", parameters: {} },
      { name: "serverList", description: "s", parameters: {}, kind: "server" },
      { name: "webSearch", description: "w", parameters: {}, kind: "provided" },
      { name: "otherHosted", description: "h", parameters: {}, kind: "hosted" },
    ]);
    expect(tools?.map((t) => t.name)).toEqual(["addWidget", "query", "serverList"]);
  });

  it("returns undefined when no tools are offered", () => {
    expect(studioToolsToChatTools(undefined)).toBeUndefined();
  });
});

describe("StudioTurnRequestSchema", () => {
  it("rejects oversized turns", () => {
    expect(() => StudioTurnRequestSchema.parse({ input: [] })).toThrow();
    expect(() => StudioTurnRequestSchema.parse({ input: new Array(41).fill({}) })).toThrow();
    expect(() => StudioTurnRequestSchema.parse({ input: [{}], instructions: "x".repeat(65537) })).toThrow();
    expect(() => StudioTurnRequestSchema.parse({ input: [{}], instructions: "x".repeat(13000) })).not.toThrow();
    expect(() =>
      StudioTurnRequestSchema.parse({ input: [{}], tools: new Array(33).fill({ name: "t", description: "", parameters: {} }) }),
    ).toThrow();
    expect(() => StudioTurnRequestSchema.parse({ input: [{}], maxTokens: 8192 })).toThrow();
  });

  it("applies safe defaults", () => {
    const parsed = StudioTurnRequestSchema.parse({ input: [{ type: "message" }] });
    expect(parsed.responseFormat).toBe("text");
    expect(parsed.maxTokens).toBe(2048);
  });
});
