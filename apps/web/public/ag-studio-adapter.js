/* AFTERPACT x AG Studio: Vultr-backed LLM adapter for the Studio Agent
 * Framework. Plain script (no modules): loaded lazily by the /studio view
 * after the vendored ag-studio UMD bundle.
 *
 * The adapter posts each turn to our own server proxy (POST /api/ai/studio-turn),
 * which holds the inference key, enforces caps, and calls Vultr. The proxy is
 * non-streaming, so the adapter emits the turn's events from the single
 * response — valid per the AgLlmResponseHandler contract.
 */
(function () {
  "use strict";

  let counter = 0;
  function nextId(prefix) {
    counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${counter}`;
  }

  function toProxyBody(request) {
    const body = { input: request.input ?? [] };
    if (typeof request.instructions === "string" && request.instructions !== "") {
      body.instructions = request.instructions;
    }
    if (Array.isArray(request.tools) && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        parameters: t.parameters ?? {},
        ...(t.kind === undefined ? {} : { kind: t.kind }),
      }));
    }
    if (request.toolChoice !== undefined) body.toolChoice = request.toolChoice;
    body.responseFormat = request.responseFormat && request.responseFormat.type === "json" ? "json" : "text";
    return body;
  }

  function createVultrStudioAdapter(endpoint) {
    return {
      executeTurn(request, options) {
        const run = (async () => {
          const ctrl = new AbortController();
          if (options && options.signal) {
            if (options.signal.aborted) ctrl.abort();
            else options.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
          }
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(toProxyBody(request)),
            signal: ctrl.signal,
          });
          let json = null;
          try {
            json = await res.json();
          } catch {
            throw new Error(`studio-turn failed (${res.status}) with a non-JSON response`);
          }
          if (!res.ok) {
            const err = json && json.error ? json.error : {};
            throw new Error(`${err.code ?? "error"}: ${err.message ?? res.statusText}`);
          }
          return json.data;
        })();

        const messageId = nextId("msg");
        const stream = {
          async *[Symbol.asyncIterator]() {
            const turn = await run;
            if (turn.content) {
              yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" };
              yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: turn.content };
              yield { type: "TEXT_MESSAGE_END", messageId };
            }
            for (const call of turn.toolCalls ?? []) {
              yield { type: "TOOL_CALL_START", toolCallId: call.id, toolCallName: call.name };
              yield { type: "TOOL_CALL_ARGS", toolCallId: call.id, delta: call.arguments };
              yield { type: "TOOL_CALL_END", toolCallId: call.id };
            }
          },
        };
        const complete = (async () => {
          const turn = await run;
          const output = [];
          if (turn.content) {
            output.push({
              id: messageId, kind: "output", type: "message", role: "assistant",
              status: "completed",
              content: [{ type: "text", text: turn.content, annotations: [] }],
            });
          }
          (turn.toolCalls ?? []).forEach((call, index) => {
            output.push({
              id: `${messageId}-tool-${index}`, kind: "output", type: "function_call",
              callId: call.id, name: call.name, arguments: call.arguments, status: "completed",
            });
          });
          const usage = turn.usage
            ? { inputTokens: turn.usage.prompt ?? 0, outputTokens: turn.usage.completion ?? 0,
                totalTokens: (turn.usage.prompt ?? 0) + (turn.usage.completion ?? 0) }
            : undefined;
          return {
            id: nextId("turn"), createdAt: Date.now(), output,
            status: "completed", usage, model: turn.model,
          };
        })();
        return { stream, complete };
      },
    };
  }

  window.AfterpactStudioAdapter = { createVultrStudioAdapter };
})();
