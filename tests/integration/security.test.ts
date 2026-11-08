import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, resolveStaticPath, type App } from "../../apps/api/src/routes";
import { toHttpError } from "../../apps/api/src/ops";

/** Raw HTTP request bypassing client-side URL normalization. */
function rawGet(port: number, target: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    let data = "";
    socket.on("data", (chunk) => { data += chunk.toString("utf8"); });
    socket.on("end", () => resolvePromise(data));
    socket.on("error", reject);
  });
}

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

let apps: App[] = [];

afterEach(async () => {
  for (const app of apps) await app.close();
  apps = [];
});

async function start(options: Parameters<typeof createApp>[0]): Promise<string> {
  const app = createApp({
    dataDir: ":memory:",
    webDir: WEB_DIR,
    processEnv: {
      ...process.env,
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_MODE: "sandbox",
      LOG_LEVEL: "silent",
      OPERATOR_TOKEN: "",
    },
    ...options,
  });
  apps.push(app);
  const port = await app.listen(0);
  return `http://localhost:${port}`;
}

async function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } } };
}

describe("static file boundaries", () => {
  it("serves real assets but never leaks files outside the web root", async () => {
    const base = await start({});
    const asset = await fetch(`${base}/styles.css`);
    expect(asset.status).toBe(200);
    // Encoded traversal: must not serve package.json (SPA shell, not JSON).
    const traversal = await fetch(`${base}/..%2f..%2fpackage.json`);
    expect(traversal.headers.get("content-type")).toContain("text/html");
    expect(await traversal.text()).not.toContain("vitest");
  });

  it("refuses prefix-sibling escapes outside the web root", async () => {
    const root = mkdtempSync(join(tmpdir(), "afterpact-web-"));
    const webDir = join(root, "public");
    mkdirSync(webDir, { recursive: true });
    writeFileSync(join(webDir, "index.html"), "<html>shell</html>");
    mkdirSync(join(root, "public-evil"), { recursive: true });
    writeFileSync(join(root, "public-evil", "secret.txt"), "top-secret");
    const base = await start({ webDir });
    const port = Number(new URL(base).port);
    const raw = await rawGet(port, "/../public-evil/secret.txt");
    expect(raw).not.toContain("top-secret");
    // Unit-level: the resolver itself rejects escapes and sibling prefixes.
    expect(resolveStaticPath(webDir, "/index.html")).toBe(join(webDir, "index.html"));
    expect(resolveStaticPath(webDir, "/../../package.json")).toBeNull();
    expect(resolveStaticPath(webDir, "/../public-evil/secret.txt")).toBeNull();
  });
});

describe("mutation rate limiting", () => {
  it("allows a burst then answers 429 with Retry-After, GET stays exempt", async () => {
    const base = await start({ rateLimit: { windowMs: 60_000, max: 3 } });
    for (let i = 0; i < 3; i += 1) {
      const res = await post(base, "/api/intents", { rawText: "", buyerId: "rl" });
      expect(res.status).not.toBe(429);
    }
    const limited = await post(base, "/api/intents", { rawText: "", buyerId: "rl" });
    expect(limited.status).toBe(429);
    expect(limited.json.error?.code).toBe("rate-limited");
    expect(limited.headers.get("retry-after")).not.toBeNull();
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
  });

  it("buckets proxied visitors by X-Forwarded-For instead of sharing loopback", async () => {
    const base = await start({ rateLimit: { windowMs: 60_000, max: 2 } });
    const mutation = { rawText: "", buyerId: "rl" };
    expect((await post(base, "/api/intents", mutation, { "x-forwarded-for": "10.0.0.1" })).status).not.toBe(429);
    expect((await post(base, "/api/intents", mutation, { "x-forwarded-for": "10.0.0.1" })).status).not.toBe(429);
    expect((await post(base, "/api/intents", mutation, { "x-forwarded-for": "10.0.0.1" })).status).toBe(429);
    // A different visitor still has budget: buckets are per forwarded IP.
    expect((await post(base, "/api/intents", mutation, { "x-forwarded-for": "10.0.0.2" })).status).not.toBe(429);
  });
});

describe("operator token", () => {
  const TOKEN = "op-secret-token";

  it("requires the token for demo reset and kill-switch when configured", async () => {
    const base = await start({ processEnv: { ...process.env, OPERATOR_TOKEN: TOKEN, LOG_LEVEL: "silent" } });
    const anon = await post(base, "/api/demo/reset", {});
    expect(anon.status).toBe(401);
    expect(anon.json.error?.code).toBe("unauthorized");
    const wrong = await post(base, "/api/demo/reset", {}, { authorization: "Bearer wrong" });
    expect(wrong.status).toBe(401);
    const kill = await post(base, "/api/admin/kill-switch", { engaged: false });
    expect(kill.status).toBe(401);
    const ok = await post(base, "/api/demo/reset", {}, { authorization: `Bearer ${TOKEN}` });
    expect(ok.status).toBe(200);
    const killOk = await post(base, "/api/admin/kill-switch", { engaged: false }, { authorization: `Bearer ${TOKEN}` });
    expect(killOk.status).toBe(200);
  });

  it("leaves operator routes open for local dev when no token is set", async () => {
    const base = await start({});
    const res = await post(base, "/api/demo/reset", {});
    expect(res.status).toBe(200);
  });
});

describe("error hygiene", () => {
  it("sanitizes unexpected errors to a generic 500", () => {
    const http = toHttpError(new Error("db password hunter2 //secret"));
    expect(http.status).toBe(500);
    expect(http.code).toBe("internal");
    expect(http.message).toBe("unexpected server error");
    expect(http.details).toBeUndefined();
  });

  it("rejects oversized bodies with 413 before routing", async () => {
    const base = await start({});
    const res = await post(base, "/api/intents", { rawText: "x".repeat(1_100_000), buyerId: "big" });
    expect(res.status).toBe(413);
    expect(res.json.error?.code).toBe("body-too-large");
  });
});
