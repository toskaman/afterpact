import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { z } from "zod";
import { HttpError, Ops, toHttpError, type OpsOptions } from "./ops";
import { continueFlagship, runFlagship, runInjection } from "./demo";

export interface ServerOptions extends OpsOptions {
  webDir?: string | null;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function resolveWebDir(explicit?: string | null): string | null {
  if (explicit === null) return null;
  if (explicit !== undefined) return explicit;
  const candidates = [
    process.env["AFTERPACT_WEB_DIR"],
    join(process.cwd(), "apps", "web", "public"),
    // Compiled layout: apps/api/dist/apps/api/src/*.js -> repo/apps/web/public.
    resolve(__dirname, "..", "..", "..", "..", "..", "..", "apps", "web", "public"),
    // Source layout fallback: apps/api/src -> apps/web/public.
    resolve(__dirname, "..", "..", "web", "public"),
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && existsSync(join(candidate, "index.html"))) return candidate;
  }
  return null;
}

async function readBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limitBytes) throw new HttpError(413, "body-too-large", "request body exceeds 1MB");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function ok(res: ServerResponse, data: unknown, status = 200): void {
  send(res, status, { data });
}

export interface App {
  ops: Ops;
  server: Server;
  webDir: string | null;
  listen: (port: number) => Promise<number>;
  close: () => Promise<void>;
}

export function createApp(options: ServerOptions = {}): App {
  const ops = new Ops(options);
  const webDir = resolveWebDir(options.webDir);

  const server = createServer((req, res) => {
    void handleRequest(req, res, ops, webDir).catch((error: unknown) => {
      const http = toHttpError(error);
      send(res, http.status, { error: { code: http.code, message: http.message, details: http.details ?? null } });
    });
  });

  return {
    ops,
    server,
    webDir,
    listen: (port: number) => new Promise((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(port, () => {
        const address = server.address();
        const bound = typeof address === "object" && address !== null ? address.port : port;
        resolveListen(bound);
      });
    }),
    close: () => new Promise((resolveClose, reject) => {
      server.close((error) => (error === undefined ? resolveClose() : reject(error)));
    }),
  };
}

function routeKey(req: IncomingMessage): { method: string; path: string; url: URL } {
  const url = new URL(req.url ?? "/", "http://localhost");
  return { method: (req.method ?? "GET").toUpperCase(), path: url.pathname, url };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, ops: Ops, webDir: string | null): Promise<void> {
  const { method, path, url } = routeKey(req);
  const query = url.searchParams;
  res.setHeader("x-request-id", `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  // -- read-only API ---------------------------------------------------------
  if (method === "GET" && path === "/api/health") return ok(res, ops.health());
  if (method === "GET" && path === "/api/config") return ok(res, ops.config());
  if (method === "GET" && path === "/api/metrics") return ok(res, ops.metrics());
  if (method === "GET" && path === "/api/intents") return ok(res, ops.listIntents());
  if (method === "GET" && path.startsWith("/api/intents/")) return ok(res, ops.getIntent(decodeURIComponent(path.slice("/api/intents/".length))));
  if (method === "GET" && path === "/api/offers") {
    const intentId = query.get("intentId");
    if (intentId === null) throw new HttpError(422, "missing-param", "query param intentId is required");
    return ok(res, ops.offersFor(intentId));
  }
  if (method === "GET" && path === "/api/promises") return ok(res, ops.listPromises(query.get("state") ?? undefined));
  if (method === "GET" && path.startsWith("/api/promises/") && !path.includes("/audit")) {
    return ok(res, ops.viewOf(decodeURIComponent(path.slice("/api/promises/".length))));
  }
  if (method === "GET" && path.startsWith("/api/payments/orders/")) return ok(res, await ops.orderStatus(decodeURIComponent(path.slice("/api/payments/orders/".length)), query.get("refresh") === "1"));
  if (method === "GET" && path.startsWith("/api/refunds/")) return ok(res, await ops.refundStatus(decodeURIComponent(path.slice("/api/refunds/".length)), query.get("refresh") === "1"));
  if (method === "GET" && path === "/api/outcomes") return ok(res, ops.listOutcomes(query.get("promiseId") ?? undefined));
  if (method === "GET" && path === "/api/incidents") return ok(res, ops.listIncidents(query.get("status") ?? undefined));
  if (method === "GET" && path.startsWith("/api/incidents/")) return ok(res, ops.getIncident(decodeURIComponent(path.slice("/api/incidents/".length))));
  if (method === "GET" && path === "/api/resolutions") return ok(res, ops.listProposals());
  if (method === "GET" && path === "/api/audit") {
    const limitRaw = query.get("limit");
    return ok(res, ops.auditList({
      promiseId: query.get("promiseId") ?? undefined,
      type: query.get("type") ?? undefined,
      limit: limitRaw === null ? undefined : Number.parseInt(limitRaw, 10),
    }));
  }
  if (method === "GET" && path === "/api/audit/export") {
    const bundle = ops.auditExport(query.get("promiseId") ?? undefined);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="afterpact-flight-recorder-${query.get("promiseId") ?? "all"}.json"`,
    });
    res.end(JSON.stringify(bundle, null, 2));
    return;
  }
  if (method === "GET" && path === "/api/discovery/status") return ok(res, ops.discoveryStatus());
  if (method === "GET" && path === "/api/studio/datasets") return ok(res, ops.studioDatasets());
  if (method === "GET" && path === "/api/timeline") {
    const promiseId = query.get("promiseId");
    if (promiseId === null || promiseId === "") throw new HttpError(422, "missing-param", "query param promiseId is required");
    return ok(res, ops.timelineFor(promiseId));
  }
  if (method === "GET" && path === "/api/demo/runs") return ok(res, [...ops.store.demoRuns.values()]);
  if (method === "GET" && path.startsWith("/api/demo/runs/")) {
    const run = ops.store.demoRuns.get(decodeURIComponent(path.slice("/api/demo/runs/".length)));
    if (run === undefined) throw new HttpError(404, "demo-not-found", "demo run not found");
    return ok(res, run);
  }

  // -- mutations ---------------------------------------------------------------
  if (method === "POST" && path === "/api/intents") return ok(res, ops.createIntent(parseJson(await readBody(req))), 201);
  if (method === "POST" && path === "/api/promises") return ok(res, ops.createPromise(parseJson(await readBody(req))), 201);
  if (method === "POST" && path.endsWith("/approve") && path.startsWith("/api/promises/")) {
    const id = decodeURIComponent(path.slice("/api/promises/".length, -"/approve".length));
    return ok(res, ops.approvePromise(id, parseJson(await readBody(req))));
  }
  if (method === "POST" && path.endsWith("/decline") && path.startsWith("/api/promises/")) {
    const id = decodeURIComponent(path.slice("/api/promises/".length, -"/decline".length));
    return ok(res, ops.declinePromise(id, parseJson(await readBody(req))));
  }
  if (method === "POST" && path.endsWith("/change") && path.startsWith("/api/promises/")) {
    const id = decodeURIComponent(path.slice("/api/promises/".length, -"/change".length));
    return ok(res, ops.changePromise(id, parseJson(await readBody(req))));
  }
  if (method === "POST" && path === "/api/payments/orders") return ok(res, await ops.createOrder(parseJson(await readBody(req))), 201);
  if (method === "POST" && path.endsWith("/buyer-approve") && path.startsWith("/api/payments/orders/")) {
    const id = decodeURIComponent(path.slice("/api/payments/orders/".length, -"/buyer-approve".length));
    return ok(res, await ops.buyerApprove(id));
  }
  if (method === "POST" && path.endsWith("/capture") && path.startsWith("/api/payments/orders/")) {
    const id = decodeURIComponent(path.slice("/api/payments/orders/".length, -"/capture".length));
    return ok(res, await ops.captureOrder(id, parseJson(await readBody(req))));
  }
  if (method === "POST" && path === "/api/outcomes") return ok(res, ops.recordOutcome(parseJson(await readBody(req))), 201);
  if (method === "POST" && path === "/api/incidents") return ok(res, ops.reportIncident(parseJson(await readBody(req))), 201);
  if (method === "POST" && path === "/api/resolutions") return ok(res, ops.proposeResolution(parseJson(await readBody(req))), 201);
  if (method === "POST" && path.endsWith("/decide") && path.startsWith("/api/resolutions/")) {
    const id = decodeURIComponent(path.slice("/api/resolutions/".length, -"/decide".length));
    return ok(res, await ops.decideResolution(id, parseJson(await readBody(req))));
  }
  if (method === "POST" && path === "/api/webhooks/paypal") {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers[key] = value;
    }
    return ok(res, await ops.handleWebhook(headers, await readBody(req)));
  }
  if (method === "POST" && path === "/api/admin/kill-switch") {
    const input = z.object({ engaged: z.boolean(), actor: z.string().min(1).max(200).default("operator") }).parse(parseJson(await readBody(req)));
    return ok(res, ops.setKillSwitch(input.engaged, input.actor));
  }
  if (method === "POST" && path === "/api/demo/run") {
    const input = z.object({ scenario: z.enum(["flagship", "injection"]), label: z.string().max(200).default("jury-demo") }).parse(parseJson(await readBody(req)));
    const run = input.scenario === "flagship" ? await runFlagship(ops, input.label) : await runInjection(ops, input.label);
    return ok(res, run, 201);
  }
  if (method === "POST" && path.endsWith("/continue") && path.startsWith("/api/demo/runs/")) {
    const id = decodeURIComponent(path.slice("/api/demo/runs/".length, -"/continue".length));
    return ok(res, await continueFlagship(ops, id));
  }
  if (method === "POST" && path === "/api/demo/reset") return ok(res, ops.resetAll());
  if (method === "POST" && path === "/api/discovery/search") return ok(res, await ops.searchDiscovery(parseJson(await readBody(req))), 201);
  if (method === "POST" && path === "/api/discovery/compare") return ok(res, await ops.compareDiscovery(parseJson(await readBody(req))));
  if (method === "POST" && path === "/api/discovery/lookup") return ok(res, await ops.lookupDiscovery(parseJson(await readBody(req))));
  if (method === "POST" && path === "/api/studio/command") return ok(res, ops.studioCommand(parseJson(await readBody(req))));

  // -- static ------------------------------------------------------------------
  if (method === "GET" && webDir !== null && !path.startsWith("/api/")) {
    return serveStatic(res, webDir, path);
  }
  throw new HttpError(404, "not-found", `${method} ${path} not found`);
}

function parseJson(raw: string): unknown {
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, "bad-json", "request body is not valid JSON");
  }
}

function serveStatic(res: ServerResponse, webDir: string, path: string): void {
  const requestPath = path === "/" ? "/index.html" : path;
  const file = normalize(join(webDir, requestPath));
  if (!file.startsWith(webDir)) throw new HttpError(403, "forbidden", "path escapes web root");
  if (!existsSync(file) || !statSync(file).isFile()) {
    // SPA fallback: unknown non-API paths serve the shell.
    const shell = join(webDir, "index.html");
    if (existsSync(shell)) {
      res.writeHead(200, { "content-type": MIME[".html"] as string });
      res.end(readFileSync(shell));
      return;
    }
    throw new HttpError(404, "not-found", "static asset not found");
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}
