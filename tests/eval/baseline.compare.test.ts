import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIntentText, scanInjection } from "../../apps/api/src/nlparse";
import { checkExpect } from "./harness";
import { SCENARIOS, type EvalScenario, type IntentInput } from "./scenarios";

/**
 * T3 §5.3 — AI contribution quantification.
 *
 * Shared set: every live intent scenario. Same scorer (harness checkExpect)
 * for both arms. Model-identity checks (fallbackUsed/origin/originPrefix)
 * are excluded for BOTH arms so the heuristic predecessor is scored only on
 * extraction/robustness. AI scores come from the four committed recorded
 * live runs — zero new inference spend. Baseline now is fixed for determinism.
 *
 * Run `BASELINE_UPDATE=1 npx vitest run tests/eval/baseline.compare.test.ts`
 * to regenerate the committed artifacts; CI runs check-only.
 */

const EVALS_DIR = join(__dirname, "..", "..", "docs", "evals");
const MD_PATH = join(EVALS_DIR, "BASELINE_COMPARISON.md");
const JSON_PATH = join(EVALS_DIR, "baseline-comparison.json");
const FIXED_NOW = Date.parse("2026-11-08T00:00:00.000Z");
const IDENTITY_CHECKS = new Set(["fallbackUsed", "origin", "originPrefix"]);

interface RecordedCheck { check: string; pass: boolean }
interface RecordedOutcome { id: string; task: string; checks: RecordedCheck[]; latencyMs: number; costUsd: number }

function isExtraction(c: { check: string }): boolean {
  return !IDENTITY_CHECKS.has(c.check);
}

function baselineChecks(scenario: EvalScenario): { check: string; pass: boolean }[] {
  const input = scenario.input as IntentInput;
  const parsed = parseIntentText(input.rawText, FIXED_NOW);
  const injection = scanInjection(input.rawText);
  const result: Record<string, unknown> = {
    origin: "heuristic-parse",
    constraints: {
      quantity: parsed.quantity,
      budgetMinor: parsed.budgetMinor,
      currency: parsed.currency,
      productType: parsed.categories[0] ?? null,
      deadlineDays: parsed.deadlineDays,
    },
    // Score the heuristic as shipped: the runtime fallback surfaces
    // parsed.notes as ambiguities (aiTasks heuristicIntent), so the
    // baseline must too — hardcoding [] would rig ambiguity checks.
    ambiguities: parsed.notes,
    requirements: parsed.mandatory,
    injection,
  };
  return checkExpect(scenario, scenario.expectLive ?? scenario.expect, result, null, { citableIds: [] })
    .filter(isExtraction)
    .map((c) => ({ check: c.check, pass: c.pass }));
}

interface Comparison {
  id: string;
  aiRuns: number;
  aiExtractionPass: number;
  baselinePass: boolean;
  baselineFailedChecks: string[];
}

function buildComparison(): { rows: Comparison[]; aiLatencyMeanMs: number; aiCostTotalUsd: number; reports: string[] } {
  const intents = SCENARIOS.filter((s) => s.task === "intent" && s.live);
  const reports = readdirSync(EVALS_DIR).filter((f) => /^report-.*\.json$/.test(f)).sort();
  if (reports.length === 0) throw new Error("no committed live reports found");
  const aiById = new Map<string, { pass: number; runs: number }>();
  let latencySum = 0;
  let latencyN = 0;
  let costSum = 0;
  for (const file of reports) {
    const report = JSON.parse(readFileSync(join(EVALS_DIR, file), "utf8")) as { outcomes: RecordedOutcome[] };
    for (const outcome of report.outcomes.filter((o) => o.task === "intent")) {
      const extraction = outcome.checks.filter(isExtraction);
      const pass = extraction.length > 0 && extraction.every((c) => c.pass);
      const entry = aiById.get(outcome.id) ?? { pass: 0, runs: 0 };
      entry.pass += pass ? 1 : 0;
      entry.runs += 1;
      aiById.set(outcome.id, entry);
      latencySum += outcome.latencyMs;
      latencyN += 1;
      costSum += outcome.costUsd;
    }
  }
  const rows: Comparison[] = intents.map((s) => {
    const ai = aiById.get(s.id) ?? { pass: 0, runs: 0 };
    const checks = baselineChecks(s);
    const failed = checks.filter((c) => !c.pass).map((c) => c.check);
    return {
      id: s.id,
      aiRuns: ai.runs,
      aiExtractionPass: ai.pass,
      baselinePass: failed.length === 0,
      baselineFailedChecks: failed,
    };
  });
  return {
    rows,
    aiLatencyMeanMs: latencyN === 0 ? 0 : Math.round(latencySum / latencyN),
    aiCostTotalUsd: Math.round(costSum * 1e6) / 1e6,
    reports,
  };
}

function renderMarkdown(data: ReturnType<typeof buildComparison>): string {
  const aiPasses = data.rows.reduce((n, r) => n + r.aiExtractionPass, 0);
  const aiRuns = data.rows.reduce((n, r) => n + r.aiRuns, 0);
  const basePasses = data.rows.filter((r) => r.baselinePass).length;
  const lines = [
    "# Baseline vs AI — intent extraction on the shared live set",
    "",
    `Shared set: ${data.rows.length} live intent scenarios, identical scorer (harness checkExpect),`,
    "model-identity checks (fallbackUsed/origin/originPrefix) excluded for both arms.",
    `AI arm: ${data.reports.length} committed recorded live runs (${data.reports.join(", ")}).`,
    "Baseline arm: deterministic heuristic parser (`parseIntentText` + `scanInjection`),",
    "fixed clock 2026-11-08T00:00:00Z, re-run locally — zero new inference spend.",
    "",
    `Aggregate extraction pass: AI ${aiPasses}/${aiRuns} vs heuristic ${basePasses}/${data.rows.length}.`,
    `AI cost on this slice: $${data.aiCostTotalUsd.toFixed(6)} total, mean latency ${data.aiLatencyMeanMs} ms.`,
    "Heuristic cost: $0, sub-millisecond.",
    "",
    "| scenario | AI (pass/runs) | heuristic | heuristic failed checks |",
    "|---|---|---|---|",
    ...data.rows.map((r) =>
      `| ${r.id} | ${r.aiExtractionPass}/${r.aiRuns} | ${r.baselinePass ? "PASS" : "FAIL"} | ${r.baselineFailedChecks.join(", ") || "—"} |`
    ),
    "",
  ];
  return lines.join("\n");
}

describe("baseline vs AI comparison artifact", () => {
  it("committed comparison matches deterministic recomputation", () => {
    const data = buildComparison();
    const md = renderMarkdown(data);
    const json = `${JSON.stringify(data, null, 2)}\n`;
    if (process.env["BASELINE_UPDATE"] === "1") {
      writeFileSync(MD_PATH, md);
      writeFileSync(JSON_PATH, json);
    }
    expect(readFileSync(MD_PATH, "utf8")).toBe(md);
    expect(readFileSync(JSON_PATH, "utf8")).toBe(json);
    expect(data.rows.length).toBeGreaterThan(0);
  });
});
