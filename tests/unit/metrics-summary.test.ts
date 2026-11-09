import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * METRICS_SUMMARY.md is generated from the committed live reports — the doc
 * header says "computed from committed reports", and this test makes that
 * claim machine-checked (a hand-edited latency column once drifted on all
 * four rows). Zero inference: pure aggregation of report JSONs.
 *
 * Run `METRICS_UPDATE=1 npx vitest run tests/unit/metrics-summary.test.ts`
 * to regenerate the table after adding a report; CI runs check-only.
 */

const EVALS_DIR = join(__dirname, "..", "..", "docs", "evals");
const MD_PATH = join(EVALS_DIR, "METRICS_SUMMARY.md");

interface LiveReport {
  generatedAt: string;
  totals: { scenarios: number; passed: number };
  live: {
    calls: number;
    modelSuccess: number;
    schemaFailures: number;
    transportFailures: number;
    citationPrecision: number;
    citationsKept: number;
    citationsDropped: number;
    gateRefusals: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    promptTokens: number;
    completionTokens: number;
  };
}

function loadReports(): { label: string; report: LiveReport }[] {
  return readdirSync(EVALS_DIR)
    .filter((f) => /^report-.*\.json$/.test(f))
    .sort()
    .map((f) => {
      const report = JSON.parse(readFileSync(join(EVALS_DIR, f), "utf8")) as LiveReport;
      const label = `${report.generatedAt.slice(11, 13)}-${report.generatedAt.slice(14, 16)}`;
      return { label, report };
    });
}

function buildTable(): string[] {
  const rows = loadReports();
  const lines = rows.map(({ label, report }) => {
    const t = report.totals;
    const l = report.live;
    return `| ${label} | ${t.passed}/${t.scenarios} | ${l.modelSuccess}/${l.calls} | ${l.schemaFailures} | ${l.transportFailures} | ${l.citationPrecision.toFixed(3)} (${l.citationsKept}/${l.citationsDropped}) | ${l.gateRefusals} | ${l.latencyP50Ms}/${l.latencyP95Ms} | ${l.promptTokens}/${l.completionTokens} |`;
  });
  const sum = (pick: (r: LiveReport) => number): number => rows.reduce((n, r) => n + pick(r.report), 0);
  const scenPass = sum((r) => r.totals.passed);
  const scenTotal = sum((r) => r.totals.scenarios);
  const modelOk = sum((r) => r.live.modelSuccess);
  const calls = sum((r) => r.live.calls);
  lines.push(
    `| **Total** | **${scenPass}/${scenTotal}** | **${modelOk}/${calls}** | ${sum((r) => r.live.schemaFailures)} | ${sum((r) => r.live.transportFailures)} | ${(sum((r) => r.live.citationsKept) / Math.max(1, sum((r) => r.live.citationsKept) + sum((r) => r.live.citationsDropped))).toFixed(3)} (${sum((r) => r.live.citationsKept)}/${sum((r) => r.live.citationsDropped)}) | ${sum((r) => r.live.gateRefusals)} | — | ${sum((r) => r.live.promptTokens)}/${sum((r) => r.live.completionTokens)} |`,
  );
  return lines;
}

describe("metrics summary artifact", () => {
  it("table matches deterministic recomputation from committed reports", () => {
    const expected = buildTable();
    expect(expected.length).toBeGreaterThan(0);
    const lines = readFileSync(MD_PATH, "utf8").split("\n");
    const headerIndex = lines.findIndex((l) => l.startsWith("| Run (UTC)"));
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    if (process.env["METRICS_UPDATE"] === "1") {
      lines.splice(headerIndex + 2, expected.length, ...expected);
      writeFileSync(MD_PATH, `${lines.join("\n")}`);
    }
    const actual = readFileSync(MD_PATH, "utf8").split("\n").slice(headerIndex + 2, headerIndex + 2 + expected.length);
    expect(actual).toEqual(expected);
  });
});
