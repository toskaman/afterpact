import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";
import { toHttpError } from "../../apps/api/src/ops";
import { AINotConfiguredError, AITransportError } from "../../packages/ai/src/index";

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

let app: App;
let base = "";

function data<T>(json: unknown): T {
  return (json as { data: T }).data;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as unknown };
}

async function get(path: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, json: (await res.json()) as unknown };
}

beforeAll(async () => {
  app = createApp({
    dataDir: ":memory:",
    webDir: WEB_DIR,
    processEnv: {
      ...process.env,
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_MODE: "sandbox",
      VULTR_INFERENCE_API_KEY: "",
      AG_STUDIO_LICENSE_KEY: "",
      LOG_LEVEL: "silent",
    },
  });
  const port = await app.listen(0);
  base = `http://localhost:${port}`;
}, 30000);

afterAll(async () => {
  await app.close();
});

describe("POST /api/ai/studio-turn", () => {
  const turn = {
    input: [
      { id: "1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "hello" }] },
    ],
  };

  it("answers 503 when no inference key is configured (strict, no fallback)", async () => {
    const res = await post("/api/ai/studio-turn", turn);
    expect(res.status).toBe(503);
    expect((res.json as { error: { code: string } }).error.code).toBe("ai-unavailable");
  });

  it("validates turn shape with 422", async () => {
    expect((await post("/api/ai/studio-turn", {})).status).toBe(422);
    expect((await post("/api/ai/studio-turn", { input: [] })).status).toBe(422);
  });

  it("rejects turns with zero mappable items", async () => {
    const res = await post("/api/ai/studio-turn", { input: [{ type: "reasoning", summary: [] }] });
    expect(res.status).toBe(422);
    expect((res.json as { error: { code: string } }).error.code).toBe("bad-turn");
  });
});

describe("AG Studio licence plumbing", () => {
  it("reports unlicensed without a key", async () => {
    const res = await get("/api/config");
    expect(res.status).toBe(200);
    const config = data<{ agStudio: { licensed: boolean; licenseKey: string | null }; features: Record<string, string> }>(res.json);
    expect(config.features["agStudio"]).toBe("ag-studio");
    expect(config.agStudio.licensed).toBe(false);
    expect(config.agStudio.licenseKey).toBeNull();
  });
});

describe("AI error HTTP mapping", () => {
  it("maps unconfigured AI to 503", () => {
    const http = toHttpError(new AINotConfiguredError());
    expect(http.status).toBe(503);
    expect(http.code).toBe("ai-unavailable");
  });

  it("maps provider failures to 502 with the AI code", () => {
    const http = toHttpError(new AITransportError("provider down", 503));
    expect(http.status).toBe(502);
    expect(http.code).toBe("ai-error");
  });
});
