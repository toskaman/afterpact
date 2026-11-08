import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";
import {
  applyStudioCommand,
  buildStudioDatasets,
  parseStudioCommand,
  StudioCommandError,
  type StudioDatasets,
} from "../../apps/api/src/studio";

/**
 * Commerce Intelligence Studio (real-data datasets + NL commands) and the
 * Recovery Operations Timeline. Datasets are asserted against live API
 * state seeded through the same routes the UI uses — never fixtures.
 */

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");
const REPO_ROOT = join(__dirname, "..", "..");

let app: App;
let base = "";

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

function data<T>(json: unknown): T {
  return (json as { data: T }).data;
}

/** Seed intent → promise → approval → order → capture; returns promiseId. */
async function seedPaidPromise(): Promise<string> {
  const intent = data<{ intent: { id: string } }>(
    (await post("/api/intents", { rawText: "Purchase three field sensor kits, budget under $500.", buyerId: "studio-test" })).json,
  ).intent;
  const offer = data<{ offers: { id: string }[] }>((await get(`/api/offers?intentId=${intent.id}`)).json).offers[0];
  if (offer === undefined) throw new Error("expected an offer");
  const promiseId = data<{ promise: { id: string } }>(
    (await post("/api/promises", { intentId: intent.id, offerId: offer.id })).json,
  ).promise.id;
  await post(`/api/promises/${promiseId}/approve`, { approvedBy: "studio-test" });
  const orderId = data<{ order: { id: string } }>((await post("/api/payments/orders", { promiseId })).json).order.id;
  await post(`/api/payments/orders/${orderId}/buyer-approve`, {});
  await post(`/api/payments/orders/${orderId}/capture`, {});
  return promiseId;
}

async function seedOpenIncident(promiseId: string): Promise<string> {
  const outcome = data<{ outcome: { id: string }; incidents: { id: string }[] }>(
    (await post("/api/outcomes", {
      promiseId,
      kind: "delivery-scan",
      summary: "Carrier scan: 2 of 3 kits delivered.",
      payload: { deliveredQuantity: 2, status: "partial" },
      provenance: { source: "simulated-logistics" },
      confidence: 1,
    })).json,
  );
  const incidentId = outcome.incidents[0]?.id;
  if (incidentId === undefined) throw new Error("expected detection to raise an incident");
  return incidentId;
}

beforeAll(async () => {
  app = createApp({
    dataDir: ":memory:",
    webDir: WEB_DIR,
    processEnv: { ...process.env, PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "", CHANNEL3_API_KEY: "", LOG_LEVEL: "silent" },
  });
  const port = await app.listen(0);
  base = `http://localhost:${port}`;
}, 30000);

afterAll(async () => {
  await app.close();
});

describe("NL command parser", () => {
  it("parses the flagship example: incidents unresolved refunds >$100", () => {
    const parsed = parseStudioCommand("incidents unresolved refunds >$100");
    expect(parsed.entity).toBe("incidents");
    expect(parsed.filters).toHaveLength(2);
    expect(parsed.filters[1]).toMatchObject({ field: "refunds", op: ">", minorValue: 10000 });
    expect(parsed.explanation).toContain("entity = incidents");
  });

  it("parses state, severity, category, currency, and merchant filters", () => {
    expect(parseStudioCommand("promises state APPROVED").filters).toMatchObject([{ field: "state", value: "APPROVED" }]);
    expect(parseStudioCommand("incidents severity high").filters).toMatchObject([{ field: "severity", value: "high" }]);
    expect(parseStudioCommand("incidents category late-delivery").filters).toMatchObject([{ field: "category", value: "late-delivery" }]);
    expect(parseStudioCommand("refunds currency USD").filters).toMatchObject([{ field: "currency", value: "USD" }]);
    expect(parseStudioCommand("promises merchant acme").filters).toMatchObject([{ field: "merchant", op: "contains" }]);
  });

  it("rejects unknown entities, tokens, and incomplete filters with hints", () => {
    expect(() => parseStudioCommand("widgets")).toThrow(StudioCommandError);
    expect(() => parseStudioCommand("incidents frobnicate")).toThrow(/Cannot understand "frobnicate"/);
    expect(() => parseStudioCommand("incidents refunds >")).toThrow(/Incomplete amount/);
    expect(() => parseStudioCommand("incidents refunds >lots")).toThrow(/Unrecognized amount/);
    expect(() => parseStudioCommand("promises state")).toThrow(/Incomplete state/);
    try {
      parseStudioCommand("incidents frobnicate");
      expect.unreachable("expected a StudioCommandError");
    } catch (error) {
      expect((error as StudioCommandError).hint).toContain("severity");
    }
  });

  it("applies commands to datasets without mutating them", () => {
    const empty: StudioDatasets = {
      kpis: {
        generatedAt: new Date().toISOString(),
        origin: "real-api",
        promiseCount: 0,
        promisesByState: {},
        openIncidentCount: 0,
        incidentsByStatus: {},
        incidentsByCategory: {},
        incidentsBySeverity: {},
        capturedMinor: 0,
        refundedMinor: 0,
        refundRateBps: null,
        atRiskMinor: 0,
        unresolvedRefundIncidentCount: 0,
        unresolvedRefundMinor: 0,
        evidenceRequired: 0,
        evidenceCollected: 0,
        outcomeCount: 0,
      },
      promises: [],
      incidents: [
        {
          id: "i1", promiseId: "p1", merchantId: "demo-merchant-acme", category: "late-delivery",
          severity: "high", status: "open", detectedAt: new Date().toISOString(), detectedBy: "policy",
          ageHours: 50, proposedRefundMinor: 0, promiseUnrefundedMinor: 38997, currency: "USD",
          proposalCount: 0, decided: false,
        },
        {
          id: "i2", promiseId: "p2", merchantId: "demo-merchant-acme", category: "quality",
          severity: "low", status: "resolved", detectedAt: new Date().toISOString(), detectedBy: "buyer",
          ageHours: 5, proposedRefundMinor: 0, promiseUnrefundedMinor: 0, currency: "USD",
          proposalCount: 1, decided: true,
        },
      ],
      captures: [],
      refunds: [],
    };
    const result = applyStudioCommand(empty, parseStudioCommand("incidents unresolved refunds >$100"));
    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: "i1" });
    expect(empty.incidents).toHaveLength(2);
    const aged = applyStudioCommand(empty, parseStudioCommand("incidents age-hours > 48"));
    expect(aged.total).toBe(1);
  });
});

describe("studio datasets over live state", () => {
  it("reflects seeded promises, captures, and open incidents", async () => {
    await post("/api/demo/reset", {});
    const promiseId = await seedPaidPromise();
    const incidentId = await seedOpenIncident(promiseId);

    const res = await get("/api/studio/datasets");
    expect(res.status).toBe(200);
    const datasets = data<StudioDatasets>(res.json);
    expect(datasets.kpis.origin).toBe("real-api");
    expect(datasets.kpis.promiseCount).toBe(1);
    expect(datasets.kpis.openIncidentCount).toBe(1);
    expect(datasets.kpis.capturedMinor).toBeGreaterThan(0);
    expect(datasets.kpis.atRiskMinor).toBe(datasets.kpis.capturedMinor);
    expect(datasets.promises[0]).toMatchObject({ id: promiseId });
    expect(datasets.incidents[0]).toMatchObject({ id: incidentId, status: "open" });
    expect(datasets.incidents[0]?.promiseUnrefundedMinor).toBeGreaterThan(10000);
    expect(datasets.captures).toHaveLength(1);
  });

  it("runs NL commands end to end, including the flagship example", async () => {
    const hit = await post("/api/studio/command", { command: "incidents unresolved refunds >$100" });
    expect(hit.status).toBe(200);
    const matched = data<{ entity: string; total: number; rows: { id: string }[]; explanation: string }>(hit.json);
    expect(matched.entity).toBe("incidents");
    expect(matched.total).toBe(1);
    expect(matched.explanation).toContain("entity = incidents");

    const miss = await post("/api/studio/command", { command: "refunds amount >$100" });
    expect(miss.status).toBe(200);
    expect(data<{ total: number }>(miss.json).total).toBe(0);

    const bad = await post("/api/studio/command", { command: "incidents frobnicate" });
    expect(bad.status).toBe(422);
    expect((bad.json as { error: { code: string; details: { hint: string } } }).error.code).toBe("studio-command");
  });

  it("builds datasets directly from the store (unit-level)", () => {
    const datasets = buildStudioDatasets(app.ops.store, app.ops.wiring.store, new Date().toISOString());
    expect(datasets.kpis.promiseCount).toBe(app.ops.store.promises.size);
    expect(datasets.incidents.length).toBe(app.ops.store.incidents.size);
  });
});

describe("recovery timeline", () => {
  it("follows the baseline before any incident", async () => {
    await post("/api/demo/reset", {});
    const promiseId = await seedPaidPromise();
    const res = await get(`/api/timeline?promiseId=${promiseId}`);
    expect(res.status).toBe(200);
    const timeline = data<{ rescheduled: boolean; tasks: { id: string; dependsOn: string[]; status: string }[]; notes: string[] }>(res.json);
    expect(timeline.rescheduled).toBe(false);
    const ids = timeline.tasks.map((t) => t.id);
    for (const expected of ["capture", "delivery", "evidence", "merchant-window", "notify", "approval", "settlement"]) {
      expect(ids).toContain(expected);
    }
    expect(timeline.tasks.find((t) => t.id === "delivery")?.dependsOn).toEqual(["capture"]);
    expect(timeline.tasks.find((t) => t.id === "evidence")?.dependsOn).toEqual(["delivery"]);
    expect(ids).not.toContain("incident-response");
  });

  it("inserts the incident chain and shifts dependents when an incident lands", async () => {
    await post("/api/demo/reset", {});
    const promiseId = await seedPaidPromise();
    const before = data<{ tasks: { id: string; end: string }[] }>((await get(`/api/timeline?promiseId=${promiseId}`)).json);
    const baselineEnd = before.tasks.find((t) => t.id === "delivery")?.end;
    await seedOpenIncident(promiseId);

    const res = await get(`/api/timeline?promiseId=${promiseId}`);
    const timeline = data<{
      rescheduled: boolean;
      tasks: { id: string; end: string; shiftedByIncident?: { baselineEnd: string; daysShifted: number } }[];
    }>(res.json);
    expect(timeline.rescheduled).toBe(true);
    const ids = timeline.tasks.map((t) => t.id);
    expect(ids).toContain("incident-response");
    const delivery = timeline.tasks.find((t) => t.id === "delivery");
    expect(delivery?.shiftedByIncident?.baselineEnd).toBe(baselineEnd);
    expect(delivery?.shiftedByIncident?.daysShifted).toBeGreaterThan(0);
    expect(Date.parse(delivery?.end ?? "")).toBeGreaterThan(Date.parse(baselineEnd ?? ""));
  });

  it("advances approval and settlement after a resolution decision", async () => {
    await post("/api/demo/reset", {});
    const run = data<{ status: string; context: Record<string, string> }>(
      (await post("/api/demo/run", { scenario: "flagship", label: "timeline-test" })).json,
    );
    expect(run.status).toBe("completed");
    const promiseId = run.context["promiseId"];
    const res = await get(`/api/timeline?promiseId=${promiseId}`);
    expect(res.status).toBe(200);
    const timeline = data<{ state: string; rescheduled: boolean; tasks: { id: string; status: string }[] }>(res.json);
    expect(timeline.state).toBe("RESOLUTION_VERIFIED");
    expect(timeline.rescheduled).toBe(true);
    expect(timeline.tasks.find((t) => t.id === "approval")?.status).toBe("done");
    expect(timeline.tasks.find((t) => t.id === "settlement")?.status).toBe("done");
    expect(timeline.tasks.find((t) => t.id === "resolution")?.status).toBe("done");
  });

  it("arms escalation for critical open incidents", async () => {
    await post("/api/demo/reset", {});
    const promiseId = await seedPaidPromise();
    await post("/api/incidents", { promiseId, category: "not-delivered", detail: "Nothing arrived at all.", severity: "critical" });
    const timeline = data<{ tasks: { id: string }[] }>((await get(`/api/timeline?promiseId=${promiseId}`)).json);
    expect(timeline.tasks.map((t) => t.id)).toContain("escalation");
  });

  it("validates timeline input", async () => {
    expect((await get("/api/timeline")).status).toBe(422);
    const missing = await get("/api/timeline?promiseId=does-not-exist");
    expect(missing.status).toBe(404);
  });
});

describe("AG Grid vendor bundle", () => {
  it("ships the pinned AG Grid Community bundle with the shell", () => {
    const bundle = join(REPO_ROOT, "apps", "web", "public", "vendor", "ag-grid-community.min.js");
    expect(existsSync(bundle)).toBe(true);
    const source = readFileSync(bundle, "utf8");
    expect(source.length).toBeGreaterThan(1_000_000);
    expect(source).toContain("36.3.0");
    const shell = readFileSync(join(REPO_ROOT, "apps", "web", "public", "index.html"), "utf8");
    expect(shell).toContain("/vendor/ag-grid-community.min.js");
  });
});

describe("AG Studio commercial bundle (no redistribution)", () => {
  const CDN_HOST_PATH = "https://cdn.jsdelivr.net/npm/ag-studio@";
  const CDN_UMD_PATH = "/dist/umd/ag-studio.min.js";
  const CDN_FULL = "https://cdn.jsdelivr.net/npm/ag-studio@3.1.0/dist/umd/ag-studio.min.js";
  it("loads the pinned bytes from the official channel, lazily, with attribution", () => {
    // Licence text + notice are tracked for attribution; the commercial
    // bytes themselves must NOT be committed (EULA forbids redistribution).
    expect(existsSync(join(REPO_ROOT, "apps", "web", "public", "vendor", "ag-studio.LICENSE.html"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "apps", "web", "public", "vendor", "ag-studio.NOTICE.txt"))).toBe(true);
    let insideGit = false;
    try {
      insideGit = execSync("git rev-parse --is-inside-work-tree", { cwd: REPO_ROOT, encoding: "utf8" }).trim() === "true";
    } catch {
      // No git available (archive checkout): the fetch script is the
      // backstop, asserted below.
    }
    if (insideGit) {
      const tracked = execSync("git ls-files apps/web/public/vendor/", { cwd: REPO_ROOT, encoding: "utf8" });
      expect(tracked).not.toContain("ag-studio.min.js");
    }
    const app = readFileSync(join(REPO_ROOT, "apps", "web", "public", "app.js"), "utf8");
    expect(app).toContain(CDN_HOST_PATH);
    expect(app).toContain(CDN_UMD_PATH);
    expect(app).toContain('AG_STUDIO_VERSION = "3.1.0"');
    expect(app).toContain("sha384-");
    expect(app).toContain("/vendor/ag-studio.min.js"); // local fallback only
    // Lazy-loaded by the /studio view only: the ~6.4 MB bundle must not
    // slow down every other page.
    const shell = readFileSync(join(REPO_ROOT, "apps", "web", "public", "index.html"), "utf8");
    expect(shell).not.toContain("ag-studio.min.js");
    expect(shell).toContain("copyright 2015-2026 by AG Grid Ltd");
    // Build-time fetch path reproduces the pinned bytes.
    const fetchScript = readFileSync(join(REPO_ROOT, "scripts", "vendor-ag-studio.mjs"), "utf8");
    expect(fetchScript).toContain(CDN_HOST_PATH);
    expect(fetchScript).toContain(CDN_UMD_PATH);
    expect(fetchScript).toContain(CDN_FULL);
    expect(fetchScript).toContain("9b83bf50eaf0a21eeb1f78b10e06f237673788c4453907572f4c4d604b324ecc");
  });
  it("uses the local build artifact when present (CI/dev fallback)", () => {
    const bundle = join(REPO_ROOT, "apps", "web", "public", "vendor", "ag-studio.min.js");
    if (!existsSync(bundle)) {
      // Clean checkout without a build step: the CDN path above covers it.
      expect(true).toBe(true);
      return;
    }
    const source = readFileSync(bundle, "utf8");
    expect(source.length).toBeGreaterThan(5_000_000);
    expect(source).toContain("3.1.0");
    expect(source).toContain("agStudio");
  });
});
