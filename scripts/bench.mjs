#!/usr/bin/env node
/* AFTERPACT impact benchmark skeleton.
 *
 * Measures reproducible timings against a RUNNING server (default
 * http://localhost:3001): flagship demo, Studio datasets, NL command,
 * timeline, audit export. Emits JSON to stdout and appends a Markdown row
 * to docs/benchmarks/IMPACT_BENCHMARK.md when --record is passed.
 *
 * Usage:
 *   npm start &            # or: PORT=3101 AFTERPACT_DATA_DIR=':memory:' npm start
 *   node scripts/bench.mjs [--base URL] [--runs N] [--record]
 */
"use strict";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.findIndex((a) => a === name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value === undefined || value.startsWith("--") ? fallback : value;
}
const BASE = flag("--base", process.env.AFTERPACT_BENCH_BASE ?? "http://localhost:3001");
const RUNS = Math.max(1, Number.parseInt(flag("--runs", "3"), 10) || 3);
const RECORD = args.includes("--record");

async function timed(label, fn) {
  const samples = [];
  let last = null;
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    last = await fn();
    samples.push(Math.round((performance.now() - start) * 10) / 10);
  }
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
  return { label, runs: RUNS, samplesMs: samples, medianMs: Math.round(median * 10) / 10, last };
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function main() {
  const health = await get("/api/health");
  const results = [];
  results.push(await timed("flagship demo (9 acts)", async () => {
    const run = await post("/api/demo/run", { scenario: "flagship", label: "bench" });
    if (run.data.status !== "completed" && run.data.status !== "awaiting-action") {
      throw new Error(`flagship did not complete: ${run.data.status}`);
    }
    return { status: run.data.status, acts: run.data.acts.length };
  }));
  const promiseId = results[0].last && (await get("/api/promises")).data.at(-1)?.promise?.id;
  results.push(await timed("studio datasets", async () => {
    const datasets = await get("/api/studio/datasets");
    return { promises: datasets.data.kpis.promiseCount, incidents: datasets.data.incidents.length };
  }));
  results.push(await timed("studio NL command", async () => {
    const nl = await post("/api/studio/command", { command: "incidents unresolved refunds >$100" });
    return { total: nl.data.total };
  }));
  if (promiseId) {
    results.push(await timed("recovery timeline", async () => {
      const timeline = await get(`/api/timeline?promiseId=${encodeURIComponent(promiseId)}`);
      return { tasks: timeline.data.tasks.length, rescheduled: timeline.data.rescheduled };
    }));
    results.push(await timed("audit export", async () => {
      const bundle = await get(`/api/audit/export?promiseId=${encodeURIComponent(promiseId)}`);
      return { entries: bundle.entries.length, chainValid: bundle.chainValid };
    }));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    transport: health.data.transport,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    results,
  };
  console.log(JSON.stringify(report, null, 2));
  if (RECORD) {
    const { appendFileSync } = await import("node:fs");
    const row = `\n| ${report.generatedAt.slice(0, 10)} | ${report.transport} | ${report.node} | ` +
      results.map((r) => `${r.label}: ${r.medianMs}ms`).join(" · ") + " |";
    appendFileSync(new URL("../docs/benchmarks/IMPACT_BENCHMARK.md", import.meta.url), `${row}\n`);
    console.error("Recorded one row in docs/benchmarks/IMPACT_BENCHMARK.md");
  }
}

main().catch((error) => {
  console.error(`bench failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
