#!/usr/bin/env node
/* Build apps/web/public/data/ai-gallery.json — the RECORDED VERIFIED AI RUN
 * gallery served on the public demo. Every featured outcome is copied
 * verbatim from a committed docs/evals/report-*.json (keyed live runs
 * against api.vultrinference.com); nothing is hand-written. Re-run after
 * any new eval report to refresh the gallery.
 *
 * Usage: node scripts/build-ai-gallery.mjs [--write]
 *   --write   emit apps/web/public/data/ai-gallery.json (default: --write)
 *   (no other mode; verification lives in tests/integration/ai.gallery.test.ts)
 */
"use strict";

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVALS = join(ROOT, "docs", "evals");
const OUT = join(ROOT, "apps", "web", "public", "gallery", "ai-gallery.json");

// Featured outcomes: [reportBasename | "latest", outcomeId]. The failed
// intent-cent-precision case is included on purpose — the gallery shows
// failures, not just passes.
const FEATURED = [
  ["latest", "intent-simple"],
  ["latest", "intent-injection-contained"],
  ["latest", "intent-conflicting"],
  ["latest", "incident-short-delivery"],
  ["latest", "incident-conflicting-evidence"],
  ["latest", "incident-injection-in-note"],
  ["latest", "incident-insufficient-evidence"],
  ["latest", "recovery-short-delivery"],
  ["latest", "recovery-full-loss"],
  ["report-2026-11-08T01-04-16-487Z.json", "intent-cent-precision"],
];

function loadReports() {
  const files = readdirSync(EVALS)
    .filter((f) => f.startsWith("report-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) throw new Error("no eval reports in docs/evals");
  return files.map((file) => ({
    file,
    report: JSON.parse(readFileSync(join(EVALS, file), "utf8")),
  }));
}

function pickOutcome(entries, file, id) {
  const entry = file === "latest" ? entries[entries.length - 1] : entries.find((e) => e.file === file);
  if (!entry) throw new Error(`eval report not found: ${file}`);
  const outcome = entry.report.outcomes.find((o) => o.id === id);
  if (!outcome) throw new Error(`outcome ${id} not found in ${entry.file}`);
  return { entry, outcome };
}

const entries = loadReports();
const runs = entries.map(({ file, report }) => ({
  report: `docs/evals/${file}`,
  recordedAt: report.generatedAt,
  provider: report.provider,
  model: report.model,
  scenarios: report.totals.scenarios,
  passed: report.totals.passed,
  failed: report.totals.failed,
  failedIds: report.totals.failedIds,
  citationPrecision: report.live.citationPrecision,
  citationsKept: report.live.citationsKept,
  citationsDropped: report.live.citationsDropped,
  latencyP50Ms: report.live.latencyP50Ms,
  latencyP95Ms: report.live.latencyP95Ms,
  promptTokens: report.live.promptTokens,
  completionTokens: report.live.completionTokens,
  costUsd: report.live.costUsd,
  schemaFailures: report.live.schemaFailures,
}));

const featured = FEATURED.map(([file, id]) => {
  const { entry, outcome } = pickOutcome(entries, file, id);
  const checks = outcome.checks.map((c) => ({ check: c.check, pass: c.pass }));
  return {
    id: outcome.id,
    task: outcome.task,
    pass: outcome.pass,
    checksPassed: checks.filter((c) => c.pass).length,
    checksTotal: checks.length,
    checks,
    latencyMs: outcome.latencyMs,
    promptTokens: outcome.promptTokens,
    completionTokens: outcome.completionTokens,
    costUsd: outcome.costUsd,
    attempts: outcome.attempts,
    fallbackUsed: outcome.fallbackUsed,
    origin: outcome.origin,
    modelServed: outcome.modelServed,
    citationsKept: outcome.citationsKept,
    citationsDropped: outcome.citationsDropped,
    gateVerdict: outcome.gateVerdict,
    category: outcome.category,
    strategy: outcome.strategy,
    sample: outcome.sample,
    sourceReport: `docs/evals/${entry.file}`,
  };
});

const gallery = {
  label: "RECORDED VERIFIED AI RUN",
  live: false,
  notice:
    "Recorded outputs from keyed live evaluation runs. No inference happens when you view this page — " +
    "the public demo ships without an inference key. Every entry below is copied verbatim from a " +
    "committed eval report; tests cross-check each value against that report.",
  provider: "vultr-inference",
  model: "deepseek-v4.1-flash-1017",
  runs,
  totals: {
    runs: runs.length,
    scenarios: runs.reduce((n, r) => n + r.scenarios, 0),
    passed: runs.reduce((n, r) => n + r.passed, 0),
    costUsd: runs.reduce((n, r) => n + r.costUsd, 0),
  },
  featured,
  reproduce: {
    requires: "VULTR_INFERENCE_API_KEY (never committed; see .env.example + docs/demo/KEY_RETRIEVAL_GUIDE.md)",
    steps: [
      "git clone https://github.com/toskaman/afterpact && cd afterpact && npm install",
      "export VULTR_INFERENCE_API_KEY=<your key>",
      "AI_EVAL_LIVE=1 npx vitest run tests/eval/ai-eval.live.test.ts  # ~2 min, ~$0.015 -> new docs/evals/report-*.json",
      "node scripts/build-ai-gallery.mjs --write   # refresh this file from the reports",
      "npx vitest run tests/integration/ai.gallery.test.ts   # verify gallery == reports",
    ],
    note: "Model identity is asserted on every call (requested vs served); a silent provider fallback fails the run.",
  },
  credentialsRedacted: true,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(gallery, null, 2) + "\n");
console.log(`ai-gallery: ${runs.length} runs, ${featured.length} featured -> apps/web/public/gallery/ai-gallery.json`);
