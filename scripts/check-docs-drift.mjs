#!/usr/bin/env node
/* CI drift detector: fails when governed docs contradict the verified
 * release manifest or restate known-stale claims.
 *
 * Checks:
 *  1. Manifest statics match the repo (via build-evidence-manifest --check).
 *  2. No banned (stale/contradictory) claim pattern appears in governed docs.
 *  3. Required live-truth markers are present.
 *
 * Usage: node scripts/check-docs-drift.mjs
 */
"use strict";

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "docs", "hackathon", "RELEASE_EVIDENCE_MANIFEST.json");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

let failures = 0;
function fail(message) {
  failures++;
  console.error(`drift-FAIL: ${message}`);
}
function ok(message) {
  console.log(`drift-ok: ${message}`);
}

// 1. Manifest statics fresh.
try {
  execSync("node scripts/build-evidence-manifest.mjs --check", { cwd: ROOT, stdio: "pipe" });
  ok("manifest statics match the repo");
} catch (err) {
  fail(`manifest statics stale:\n${(err.stdout ?? "")}${(err.stderr ?? "")}`.trim());
}

if (!existsSync(MANIFEST)) {
  fail("manifest missing");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

// 2. Banned stale-claim patterns: [files, regex, why].
// Scope each pattern to the files where the stale claim was found so new
// prose cannot trip on historical notes elsewhere.
const BANNED = [
  [["README.md"], /No LLM inference runs in this build/, "README denies runtime AI"],
  [["README.md"], /155 (passing )?tests|156 tests/, "README stale test count"],
  [["README.md"], /5 projects/, "README stale typecheck count (6 projects)"],
  [["README.md"], /deploy is a human step/i, "README claims deploy is a human step (Vultr live)"],
  [["docs/RELEASE_GATE.md"], /15[56] (passing )?tests/, "RELEASE_GATE stale test count"],
  [["docs/RELEASE_GATE.md"], /AG Studio explicitly NOT claimed/, "RELEASE_GATE denies Studio usage"],
  [["docs/RELEASE_GATE.md"], /_NONE_ redistributed|no proprietary\/trial binaries/i, "RELEASE_GATE denies trial binaries"],
  [["docs/RELEASE_GATE.md"], /No git repo initialized yet/, "RELEASE_GATE predates the repo"],
  [["docs/RELEASE_GATE.md"], /never run on GitHub yet/, "RELEASE_GATE predates CI"],
  [["docs/RELEASE_GATE.md"], /apply (the )?Render Blueprint/i, "RELEASE_GATE Render deploy step"],
  [["docs/demo/DEVPOST_DRAFT.md"], /15[56] (passing )?tests/, "DEVPOST stale test count"],
  [["docs/demo/DEVPOST_DRAFT.md"], /Verify the live-sandbox flagship/, "DEVPOST stale what's-next (flagship verified)"],
  [["docs/demo/DEVPOST_DRAFT.md"], /AG Studio not in (this )?build/i, "DEVPOST denies Studio usage"],
  [["docs/demo/DEVPOST_DRAFT.md"], /hosted deploy is a human step/i, "DEVPOST predates Vultr hosting"],
  [["docs/demo/DEVPOST_DRAFT.md"], /apply the Render Blueprint/i, "DEVPOST Render deploy step"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], /15[56] (passing )?tests/, "JURY stale test count"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], /no stochastic LLM evals to reproduce/i, "JURY denies LLM evals"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], /22 tests in policy/i, "JURY wrong policy count (11)"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], /never run on GitHub yet/, "JURY predates CI"],
  [["docs/demo/DEMO_SCRIPT.md"], /open the Render URL/i, "DEMO_SCRIPT Render URL"],
  [["docs/demo/FRONTEND_DEMO_GUIDE.md"], /no Playwright in this repo/i, "FRONTEND guide denies Playwright"],
  [["docs/sponsors/AG_STUDIO_UPGRADE_PATH.md"], /NOT IMPLEMENTED, nothing claimed as done/i, "UPGRADE_PATH stale header"],
  [["docs/sponsors/RENDER_DEPLOYMENT.md"], /^# AFTERPACT on Render/m, "RENDER doc lacks redirect header"],
  [["docs/sponsors/CHANNEL3_INTEGRATION.md"], /set the key on the Render service/i, "CHANNEL3 Render service ref"],
];

for (const [files, pattern, why] of BANNED) {
  for (const file of files) {
    if (!existsSync(join(ROOT, file))) {
      fail(`governed doc missing: ${file}`);
      continue;
    }
    // RENDER_DEPLOYMENT check is inverted (must NOT start with the old title).
    if (file.endsWith("RENDER_DEPLOYMENT.md")) {
      if (pattern.test(read(file))) fail(`${why} (${file})`);
      continue;
    }
    if (pattern.test(read(file))) fail(`${why} (${file})`);
  }
}

// 3. Required live-truth markers.
const REQUIRED = [
  ["README.md", /RELEASE_EVIDENCE_MANIFEST/, "README cites the evidence manifest"],
  ["README.md", /copyright 2015-2026 by AG Grid Ltd/, "README carries Studio attribution"],
  ["LICENSE", /THIRD-PARTY CARVE-OUT/, "LICENSE carries the commercial carve-out"],
  ["docs/sponsors/ag-studio-trial.md", /consent request/i, "trial doc holds the consent draft"],
  ["docs/sponsors/AG_GRID_STATUS.md", /No redistribution/, "AG Grid status states no-redistribution"],
  ["docs/demo/DEVPOST_DRAFT.md", /AI tools used/i, "DEVPOST lists AI tools used"],
];

for (const [file, pattern, why] of REQUIRED) {
  if (!existsSync(join(ROOT, file))) {
    fail(`governed doc missing: ${file}`);
    continue;
  }
  if (!pattern.test(read(file))) fail(`missing: ${why} (${file})`);
}

// 4. Manifest grade honesty: docs must not claim artifact-backed Channel3
// live execution while the manifest grades it below artifact.
if (manifest.channel3Live?.grade !== "artifact") {
  const suspects = ["docs/hackathon/JURY_EVIDENCE_MATRIX.md", "docs/audit/100_QUESTIONS.md"];
  for (const file of suspects) {
    if (!existsSync(join(ROOT, file))) continue;
    for (const line of read(file).split("\n")) {
      if (!/channel3/i.test(line)) continue;
      if (/NOT VERIFIED|retract|WITHOUT a committed|pending/i.test(line)) continue;
      if (/\bexecuted live\b|\blive\b[^.\n]{0,60}\bgreen\b/i.test(line)) {
        fail(`${file} claims live Channel3 execution but manifest grade is ${manifest.channel3Live?.grade}: ${line.trim().slice(0, 120)}`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`drift: ${failures} contradiction(s) found`);
  process.exit(1);
}
ok("no governed-doc contradictions found");
