import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { vultrConfigFromEnv } from "../../packages/ai/src/index";
import { SCENARIOS } from "./scenarios";
import {
  liveServiceFromEnv,
  runScenario,
  summarize,
  type ScenarioOutcome,
} from "./harness";

/**
 * Live AI eval: runs every live-eligible scenario against the real model and
 * writes a machine-generated evidence report to docs/evals/. Runs ONLY when
 * VULTR_INFERENCE_API_KEY is present AND AI_EVAL_LIVE=1; otherwise skips.
 * Never runs in CI by default (cost + latency + model variance are opt-in).
 */
const { hasKey } = vultrConfigFromEnv(process.env);
const LIVE = hasKey && process.env["AI_EVAL_LIVE"] === "1";
const describeLive = LIVE ? describe : describe.skip;

const outcomes: ScenarioOutcome[] = [];

describeLive("AI eval suite (live model)", () => {
  for (const scenario of SCENARIOS.filter((s) => s.live)) {
    it(
      `live/${scenario.id} — ${scenario.description}`,
      async () => {
        const outcome = await runScenario(scenario, liveServiceFromEnv(), "live");
        outcomes.push(outcome);
        expect(outcome.checks.filter((c) => !c.pass)).toEqual([]);
        expect(outcome.pass).toBe(true);
      },
      120_000,
    );
  }

  afterAll(() => {
    if (outcomes.length === 0) return;
    const { config } = vultrConfigFromEnv(process.env);
    const report = summarize(outcomes, "live", "vultr-inference", config.model);
    const stamp = report.generatedAt.replace(/[:.]/g, "-");
    const path = join(__dirname, "..", "..", "docs", "evals", `report-${stamp}.json`);
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
    // Machine-generated summary line for the operator (also in the JSON).
    // eslint-disable-next-line no-console
    console.log(
      `[ai-eval] ${report.totals.passed}/${report.totals.scenarios} passed · ` +
        `modelSuccess ${report.live.modelSuccess}/${report.live.calls} · ` +
        `schemaFail ${report.live.schemaFailures} · transportFail ${report.live.transportFailures} · ` +
        `citationPrecision ${report.live.citationPrecision.toFixed(3)} · ` +
        `p50 ${report.live.latencyP50Ms}ms p95 ${report.live.latencyP95Ms}ms · ` +
        `tokens ${report.live.promptTokens}+${report.live.completionTokens} · ` +
        `cost $${report.live.costUsd.toFixed(6)} · report ${path}`,
    );
  });
});
