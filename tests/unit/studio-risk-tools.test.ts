import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import vm from "node:vm";

/**
 * Outcome Risk Analyst custom tools: read-only, capped, fail-closed.
 * The browser script runs in a vm sandbox with stubbed window/fetch and a
 * stub Studio api, so every assertion below is hermetic (no bundle, no key).
 */

const RISK_TOOLS_PATH = join(__dirname, "..", "..", "apps", "web", "public", "ag-studio-risk-tools.js");

type Ctx = {
  signal: AbortSignal;
  success: (text: string, data?: unknown) => { ok: true; text: string; data: unknown };
  error: (text: string) => { ok: false; text: string };
};

function shapeBuilder(): any {
  const chain = { optional: () => chain };
  return {
    object: (_shape: unknown) => chain,
    string: (_opts?: unknown) => chain,
    number: (_opts?: unknown) => chain,
    boolean: (_opts?: unknown) => chain,
  };
}

function loadTools(fetchImpl: (url: string, opts?: unknown) => Promise<any>): {
  toolsApi: any;
  defs: { name: string; description: string; execute: (args: any, ctx: Ctx) => Promise<any> }[];
  fetchCalls: { url: string; opts: any }[];
} {
  const defs: { name: string; description: string; execute: (args: any, ctx: Ctx) => Promise<any> }[] = [];
  const fetchCalls: { url: string; opts: any }[] = [];
  const sandbox: Record<string, any> = {
    window: {},
    fetch: (url: string, opts?: unknown) => {
      fetchCalls.push({ url, opts });
      return fetchImpl(url, opts);
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(RISK_TOOLS_PATH, "utf8"), sandbox, { filename: "ag-studio-risk-tools.js" });
  const toolsApi = sandbox["window"].AfterpactStudioRiskTools;
  const studioApi = {
    defineAiTool: (def: { name: string; description: string; params: (s: any) => unknown; execute: any }) => {
      def.params(shapeBuilder()); // params builder must run without throwing
      defs.push({ name: def.name, description: def.description, execute: def.execute });
      return { tool: def.name };
    },
  };
  toolsApi.defineRiskTools(studioApi);
  return { toolsApi, defs, fetchCalls };
}

function okDatasets(payload: unknown): (url: string) => Promise<any> {
  return async (_url: string) => ({ ok: true, status: 200, json: async () => ({ data: payload }) });
}

function ctx(): Ctx {
  return {
    signal: new AbortController().signal,
    success: (text: string, data?: unknown) => ({ ok: true as const, text, data }),
    error: (text: string) => ({ ok: false as const, text }),
  };
}

const FIXTURE = {
  incidents: [
    { id: "aaa-high-open", category: "not-delivered", severity: "high", status: "open", promiseUnrefundedMinor: 9000, currency: "USD", ageHours: 30, proposalCount: 0, decided: false },
    { id: "bbb-low-open", category: "late-delivery", severity: "low", status: "open", promiseUnrefundedMinor: 100, currency: "USD", ageHours: 5, proposalCount: 1, decided: false },
    { id: "ccc-resolved", category: "overcharge", severity: "medium", status: "resolved", promiseUnrefundedMinor: 50000, currency: "USD", ageHours: 90, proposalCount: 1, decided: true },
  ],
  promises: [
    { id: "promise-1", merchantId: "sandbox-merchant", state: "INCIDENT_DETECTED", totalMinor: 12999, currency: "USD", approved: true, incidentCount: 1, openIncidentCount: 1, outcomeCount: 2, evidenceCount: 1, evidenceRequired: 2 },
    { id: "promise-2", merchantId: "sandbox-merchant", state: "RESOLUTION_VERIFIED", totalMinor: 5000, currency: "USD", approved: true, incidentCount: 0, openIncidentCount: 0, outcomeCount: 1, evidenceCount: 2, evidenceRequired: 2 },
  ],
  captures: [{ id: "capture-1", remainingMinor: 8666 }],
  refunds: [
    { id: "refund-1", status: "succeeded", amountMinor: 4333, currency: "USD", captureId: "capture-1", reason: "partial" },
    { id: "refund-2", status: "requested", amountMinor: 1000, currency: "USD", captureId: "capture-1", reason: "review" },
  ],
};

describe("studio risk tools", () => {
  it("defines exactly the three documented read-only tools", () => {
    const { toolsApi, defs } = loadTools(okDatasets(FIXTURE));
    expect(toolsApi.TOOL_NAMES).toEqual([
      "get_incident_exposure",
      "get_promise_outcome_comparison",
      "get_refund_verification_status",
    ]);
    expect(defs.map((d) => d.name)).toEqual(toolsApi.TOOL_NAMES);
    for (const def of defs) {
      expect(def.description).toMatch(/read-only/i);
    }
  });

  it("ranks open incidents by unrefunded exposure and caps rows", async () => {
    const { defs, fetchCalls } = loadTools(okDatasets(FIXTURE));
    const tool = defs[0];
    const result = await tool.execute({ top_n: 2 }, ctx());
    expect(result.ok).toBe(true);
    // Open incidents first, exposure-descending; the big resolved row sorts last.
    expect(result.text.indexOf("aaa-high")).toBeLessThan(result.text.indexOf("bbb-low"));
    expect(result.text).toContain("90.00 USD (9000 minor)");
    expect((result.data as any).exposure).toHaveLength(2);
    expect((result.data as any).scope).toEqual({ incidents: 3, open: 2, shown: 2 });

    // Absurd top_n is clamped to MAX_ROWS, never unbounded.
    const capped = await tool.execute({ top_n: 9999 }, ctx());
    expect((capped.data as any).scope.shown).toBe(3);
    expect(fetchCalls.length).toBe(2);
    for (const call of fetchCalls) {
      expect(call.url).toBe("/api/studio/datasets");
      expect(Object.keys(call.opts ?? {}).sort()).toEqual(["signal"]);
    }
  });

  it("compares promised versus observed outcomes with evidence coverage", async () => {
    const { defs } = loadTools(okDatasets(FIXTURE));
    const tool = defs[1];
    const all = await tool.execute({}, ctx());
    expect(all.ok).toBe(true);
    expect(all.text).toContain("sandbox-merchant");
    expect(all.text).toContain("evidence 1/2");
    // Text shows short ids for context hygiene; full ids ride in data.
    expect((all.data as any).promises.map((p: any) => p.id)).toEqual(["promise-1", "promise-2"]);
    const openOnly = await tool.execute({ only_open: true }, ctx());
    expect((openOnly.data as any).promises).toHaveLength(1);
    expect((openOnly.data as any).promises[0].id).toBe("promise-1");
  });

  it("reports refund verification status and rejects unknown statuses", async () => {
    const { defs } = loadTools(okDatasets(FIXTURE));
    const tool = defs[2];
    const all = await tool.execute({}, ctx());
    expect(all.ok).toBe(true);
    expect(all.text).toContain("succeeded=1");
    expect(all.text).toContain("requested=1");
    expect((all.data as any).refunds[0].captureRemainingMinor).toBe(8666);

    const filtered = await tool.execute({ status: "requested" }, ctx());
    expect((filtered.data as any).refunds).toHaveLength(1);

    const bad = await tool.execute({ status: "wire-fraud" }, ctx());
    expect(bad.ok).toBe(false);
    expect(bad.text).toContain("requested, submitted, succeeded, failed");
  });

  it("fails closed when the datasets endpoint is unreachable", async () => {
    const { defs } = loadTools(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    for (const tool of defs) {
      const result = await tool.execute({}, ctx());
      expect(result.ok).toBe(false);
      expect(result.text).toMatch(/failed|unavailable/);
    }
  });

  it("contains no money-moving endpoint or mutation", () => {
    // Strip comments so prose like "No POST" cannot trip the tripwire.
    const source = readFileSync(RISK_TOOLS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    // No fetch `method` override anywhere: every call is a plain GET.
    expect(source.includes("method"), "risk tools must not set a fetch method (GET only)").toBe(false);
    for (const banned of ["POST", "PUT", "DELETE", "PATCH", "/api/resolutions", "/api/payments", "/api/promises/", "/decide", "/capture", "/reset", "/admin/"]) {
      expect(source.includes(banned), `risk tools must not reference ${banned}`).toBe(false);
    }
    expect(source).toContain("/api/studio/datasets");
  });

  it("instructs the analyst to stay read-only under human authorization", () => {
    const { toolsApi } = loadTools(okDatasets(FIXTURE));
    expect(toolsApi.RISK_ANALYST_INSTRUCTIONS).toMatch(/read-only/);
    expect(toolsApi.RISK_ANALYST_INSTRUCTIONS).toMatch(/human authorization/);
    expect(toolsApi.RISK_ANALYST_INSTRUCTIONS).toMatch(/never invent/i);
    expect(toolsApi.RISK_STARTER.label).toBe("Outcome risk briefing");
  });
});
