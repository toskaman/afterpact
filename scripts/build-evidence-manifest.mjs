#!/usr/bin/env node
/* Build (or verify) docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json — the
 * single source of truth for verified release claims.
 *
 * Static facts are recomputed from the repo on every run (test file list,
 * typecheck projects, newman stats, eval reports, screenshots, vendor
 * pins). Dynamic counts (suite passed/skipped, e2e, CI run) are recorded
 * from an observed green run via CLI args — never invented.
 *
 * Usage:
 *   node scripts/build-evidence-manifest.mjs --check
 *     # recompute statics, diff vs committed manifest, exit 1 on drift
 *   node scripts/build-evidence-manifest.mjs --write \
 *     --passed 245 --failed 0 --skipped 33 \
 *     --e2e-passed 5 --e2e-total 5 \
 *     --ci-run https://github.com/toskaman/afterpact/actions/runs/XXX \
 *     --commit <sha> [--allow-dirty]
 */
"use strict";

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "docs", "hackathon", "RELEASE_EVIDENCE_MANIFEST.json");

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function sha256Of(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(dir, suffix) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, suffix));
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out.sort();
}

function rel(path) {
  return path.slice(ROOT.length).replace(/\\/g, "/");
}

/** Count static it()/test() blocks (excludes .skip/.todo and loops). */
function staticTestBlocks(files) {
  let count = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const matches = src.match(/(?<![\w.])(?:it|test)\s*\(/g);
    count += matches ? matches.length : 0;
  }
  return count;
}

function collectStatics() {
  const unitFiles = listFiles(join(ROOT, "tests", "unit"), ".test.ts")
    .concat(listFiles(join(ROOT, "tests", "integration"), ".test.ts"));
  const e2eFiles = listFiles(join(ROOT, "tests", "e2e"), ".e2e.ts");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const typecheckProjects = [...pkg.scripts.typecheck.matchAll(/-p\s+(\S+)/g)].map((m) => m[1]);

  let newman = null;
  const newmanPath = join(ROOT, "postman", "newman-report.json");
  if (existsSync(newmanPath)) {
    const report = JSON.parse(readFileSync(newmanPath, "utf8"));
    const stats = report.run.stats;
    newman = {
      report: "postman/newman-report.json",
      requestsExecuted: stats.requests.total - stats.requests.pending,
      requestsFailed: stats.requests.failed,
      assertions: stats.assertions.total,
      assertionsFailed: stats.assertions.failed,
    };
  }

  const evalReports = [];
  for (const file of listFiles(join(ROOT, "docs", "evals"), ".json")) {
    if (file.endsWith("package.json")) continue;
    try {
      const report = JSON.parse(readFileSync(file, "utf8"));
      evalReports.push({
        report: rel(file),
        generatedAt: report.generatedAt ?? null,
        model: report.model ?? report.modelServed ?? null,
        passed: report.passed ?? null,
        total: report.total ?? report.scenarios ?? null,
        citationPrecision: report.citationPrecision ?? null,
        costUsd: report.costUsd ?? report.totalCostUsd ?? null,
      });
    } catch {
      evalReports.push({ report: rel(file), unparseable: true });
    }
  }

  const screenshots = listFiles(join(ROOT, "docs", "demo", "screenshots"), ".png").map(rel);

  let studioBundleTracked = null;
  try {
    const tracked = sh("git ls-files apps/web/public/vendor/");
    studioBundleTracked = tracked.includes("ag-studio.min.js");
  } catch {
    studioBundleTracked = null; // no git (archive checkout)
  }
  const vendorScript = readFileSync(join(ROOT, "scripts", "vendor-ag-studio.mjs"), "utf8");
  const pin = vendorScript.match(/EXPECTED_SHA256 = "([0-9a-f]{64})"/);

  return {
    suiteFiles: unitFiles.map(rel),
    suiteFileCount: unitFiles.length,
    suiteStaticBlocks: staticTestBlocks(unitFiles),
    e2eFiles: e2eFiles.map(rel),
    e2eStaticBlocks: staticTestBlocks(e2eFiles),
    typecheckProjects,
    newman,
    evalReports,
    screenshots,
    agStudio: {
      version: "3.1.0",
      sha256Pin: pin ? pin[1] : null,
      bundleTrackedInGit: studioBundleTracked,
      licenseFiled: existsSync(join(ROOT, "apps", "web", "public", "vendor", "ag-studio.LICENSE.html")),
      noticeFiled: existsSync(join(ROOT, "apps", "web", "public", "vendor", "ag-studio.NOTICE.txt")),
    },
  };
}

function args() {
  const out = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith("--")) {
      const key = raw[i].slice(2);
      const next = raw[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const opts = args();
const statics = collectStatics();

if (opts.check) {
  if (!existsSync(MANIFEST)) {
    console.error("drift: manifest missing, run build-evidence-manifest.mjs --write first");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const mismatches = [];
  for (const [key, value] of Object.entries(statics)) {
    if (JSON.stringify(manifest.statics?.[key]) !== JSON.stringify(value)) {
      mismatches.push(key);
    }
  }
  if (mismatches.length > 0) {
    console.error(`drift: static facts changed without manifest regen: ${mismatches.join(", ")}`);
    console.error("Run: node scripts/build-evidence-manifest.mjs --write --passed N ... (with observed values)");
    process.exit(1);
  }
  console.log("drift: statics match the committed manifest.");
  process.exit(0);
}

if (!opts.write) {
  console.error("usage: build-evidence-manifest.mjs --check | --write --passed N --failed N --skipped N --e2e-passed N --e2e-total N --ci-run URL --commit SHA");
  process.exit(2);
}

for (const key of ["passed", "failed", "skipped", "e2e-passed", "e2e-total", "ci-run", "commit"]) {
  if (opts[key] === undefined) {
    console.error(`missing required --${key} (dynamic counts must come from an observed run)`);
    process.exit(2);
  }
}

let previous = {};
if (existsSync(MANIFEST)) previous = JSON.parse(readFileSync(MANIFEST, "utf8"));

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  verifiedCommit: opts.commit,
  verifiedCiRun: opts["ci-run"],
  suite: {
    passed: Number(opts.passed),
    failed: Number(opts.failed),
    skipped: Number(opts.skipped),
  },
  e2e: { passed: Number(opts["e2e-passed"]), total: Number(opts["e2e-total"]) },
  statics,
  // Human-verified claims below: updated only with fresh artifact evidence.
  // Grades: "artifact" (committed evidence) | "asserted" (docs only) |
  // "not-verified" | "missing".
  paypalLiveLoop: previous.paypalLiveLoop ?? {
    grade: "asserted",
    order: "2ER387580K033722V",
    capture: "7R158417X9367771B",
    refund: "8DJ895035B173303G",
    evidence: null,
  },
  channel3Live: previous.channel3Live ?? { grade: "not-verified", evidence: null },
  agStudioTrial: previous.agStudioTrial ?? {
    keyInstalled: false,
    consent: "drafted-not-sent",
    judgingWindowCovered: "unknown",
  },
  hosting: previous.hosting ?? {
    url: "https://199.247.9.188.nip.io",
    provider: "vultr",
    checkedAt: null,
  },
  video: previous.video ?? { url: null, status: "missing-owner-action" },
  devpost: previous.devpost ?? { status: "draft-not-submitted" },
  knownLimitations: previous.knownLimitations ?? [
    "single-node JSON snapshot persistence",
    "shared demo state across visitors (sessions land in P1-S)",
    "no chaos/load campaign yet",
    "no independent usability test yet",
    "video missing (owner)",
  ],
};

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest written: docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json @ ${opts.commit.slice(0, 7)}`);
