import { z } from "zod";
import type {
  AIService,
  ChatMessageInput,
  ChatToolCallInput,
  ChatToolInput,
} from "../../../packages/ai/src/index";

/**
 * AG Studio Agent Framework proxy (server side).
 *
 * The browser adapter posts Studio conversation turns here; this module maps
 * them onto provider chat calls. The inference key never leaves the server.
 * Turns are STRICT: failures surface as errors, never as fabricated turns.
 * Only `client` tools are forwarded — Studio executes those in the browser
 * against its own API; provider-hosted or server-executed tools have no
 * executor in this loop and are dropped (documented, tested).
 */

const MAX_ITEMS = 40;
// Studio-generated system text (orchestrator instructions ~13K, schema dumps
// in tool outputs) is long by design; caps stay bounded for cost control.
const MAX_TEXT = 32000;
const MAX_INSTRUCTIONS = 65536;
const MAX_TOOLS = 32;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    const record = asRecord(part);
    if (record !== null && record["type"] === "text" && typeof record["text"] === "string") {
      parts.push(record["text"]);
    }
  }
  return parts.join("\n").slice(0, MAX_TEXT);
}

/**
 * Maps AG Studio conversation items onto OpenAI-style chat messages.
 * Unknown item shapes are skipped (defensive: Studio versions may add new
 * kinds; a turn with zero mappable messages is rejected, never guessed).
 */
export function studioItemsToChatMessages(input: unknown[]): ChatMessageInput[] {
  const messages: ChatMessageInput[] = [];
  const items = Array.isArray(input) ? input.slice(-MAX_ITEMS) : [];
  for (const item of items) {
    const record = asRecord(item);
    if (record === null) continue;
    const type = record["type"];
    if (type === "message" && record["kind"] === "input") {
      const role = record["role"];
      if (role !== "user" && role !== "system") continue;
      messages.push({ role, content: textOf(record["content"]) });
      continue;
    }
    if (type === "message" && record["kind"] === "output" && record["role"] === "assistant") {
      messages.push({ role: "assistant", content: textOf(record["content"]) });
      continue;
    }
    if (type === "function_call") {
      const callId = record["callId"];
      const name = record["name"];
      const args = record["arguments"];
      if (typeof callId !== "string" || typeof name !== "string" || typeof args !== "string") continue;
      const toolCalls: ChatToolCallInput[] = [{ id: callId, name, arguments: args.slice(0, MAX_TEXT) }];
      messages.push({ role: "assistant", content: null, toolCalls });
      continue;
    }
    if (type === "function_call_output") {
      const callId = record["callId"];
      const output = record["output"];
      if (typeof callId !== "string" || typeof output !== "string") continue;
      messages.push({ role: "tool", content: output.slice(0, MAX_TEXT), toolCallId: callId });
      continue;
    }
    // "reasoning" and unknown kinds: skipped deliberately (reasoning must not
    // leak across providers; unknown kinds must not be guessed).
  }
  return messages;
}

export const StudioTurnRequestSchema = z.object({
  input: z.array(z.unknown()).min(1).max(MAX_ITEMS),
  instructions: z.string().max(MAX_INSTRUCTIONS).optional(),
  tools: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(2000).default(""),
        parameters: z.record(z.string(), z.unknown()).default({}),
        kind: z.string().max(40).optional(),
      }),
    )
    .max(MAX_TOOLS)
    .optional(),
  toolChoice: z.union([z.enum(["auto", "none", "required"]), z.object({ name: z.string().min(1).max(120) })]).optional(),
  responseFormat: z.enum(["text", "json"]).default("text"),
  maxTokens: z.number().int().min(64).max(4096).default(2048),
});
export type StudioTurnRequest = z.infer<typeof StudioTurnRequestSchema>;

export function studioToolsToChatTools(tools: StudioTurnRequest["tools"]): ChatToolInput[] | undefined {
  if (tools === undefined) return undefined;
  return tools
    .filter((t) => t.kind === undefined || t.kind === "client" || t.kind === "server")
    .map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

export interface StudioTurnResult {
  content: string;
  toolCalls: ChatToolCallInput[];
  finishReason: string | null;
  usage: { prompt: number; completion: number };
  costUsd: number;
  model: string;
  latencyMs: number;
}

export async function studioTurn(service: AIService, raw: unknown): Promise<StudioTurnResult> {
  const input = StudioTurnRequestSchema.parse(raw);
  const messages = studioItemsToChatMessages(input.input);
  if (messages.length === 0) {
    throw new StudioTurnError("no mappable conversation items in turn input");
  }
  if (input.instructions !== undefined && input.instructions !== "") {
    messages.unshift({ role: "system", content: input.instructions });
  }
  const result = await service.chatTurn({
    messages,
    tools: studioToolsToChatTools(input.tools),
    ...(input.toolChoice === undefined ? {} : { toolChoice: input.toolChoice }),
    responseFormat: input.responseFormat,
    maxTokens: input.maxTokens,
  });
  return {
    content: result.content,
    toolCalls: result.toolCalls,
    finishReason: result.finishReason,
    usage: result.usage,
    costUsd: result.costUsd,
    model: result.modelServed,
    latencyMs: result.latencyMs,
  };
}

export class StudioTurnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioTurnError";
  }
}
