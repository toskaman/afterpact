#!/usr/bin/env node
/* CI drift detector: fails when governed docs contradict the verified
 * release manifest or restate known-stale claims.
 *
 * Checks (validators live in scripts/drift-lib.mjs, unit-tested):
 *  1. Manifest statics match the repo (via build-evidence-manifest --check).
 *  2. No banned (stale/contradictory) claim pattern appears in governed docs.
 *  3. Required live-truth markers are present.
 *  4. Channel3 grade honesty vs the manifest.
 *  5. Test-count claims in live docs equal the manifest's canonical numbers.
 *  6. Wording claims (live-mode, isolation, usability, mock-as-live,
 *     Studio trial, video/Devpost status) match the manifest posture.
 *  7. Manifest lineage: verifiedCommit is HEAD or docs-only behind it.
 *
 * Usage: node scripts/check-docs-drift.mjs
 */
"use strict";

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkChannel3Grade,
  checkLineage,
  checkRequiredMarkers,
  checkStalePatterns,
  checkTestCounts,
  checkWording,
} from "./drift-lib.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(ROOT, "docs", "hackathon", "RELEASE_EVIDENCE_MANIFEST.json");

function read(rel) {
  const full = join(ROOT, rel);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
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

// 2-6. Lib validators.
for (const message of checkStalePatterns(read)) fail(message);
for (const message of checkRequiredMarkers(read)) fail(message);
for (const message of checkChannel3Grade(manifest, read)) fail(message);
for (const message of checkTestCounts(manifest, read)) fail(message);
for (const message of checkWording(manifest, read)) fail(message);
if (failures === 0) ok("governed-doc claims match the manifest");

// 7. Manifest lineage (git-backed).
try {
  const headSha = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  let isAncestor = false;
  try {
    execSync(`git merge-base --is-ancestor ${manifest.verifiedCommit} HEAD`, { cwd: ROOT, stdio: "pipe" });
    isAncestor = true;
  } catch {
    isAncestor = false;
  }
  let changedFiles = [];
  if (isAncestor) {
    const out = execSync(`git diff --name-only ${manifest.verifiedCommit}..HEAD`, { cwd: ROOT, encoding: "utf8" }).trim();
    changedFiles = out === "" ? [] : out.split("\n");
  }
  const lineageFailures = checkLineage({
    verifiedCommit: manifest.verifiedCommit,
    headSha,
    isAncestor,
    changedFiles,
    gitAvailable: true,
  });
  for (const message of lineageFailures) fail(message);
  if (lineageFailures.length === 0) ok(`manifest lineage clean (verifiedCommit ${manifest.verifiedCommit}, HEAD ${headSha.slice(0, 7)})`);
} catch (err) {
  ok(`lineage skipped: git unavailable (${err instanceof Error ? err.message.slice(0, 100) : "unknown"})`);
}

if (failures > 0) {
  console.error(`drift: ${failures} contradiction(s) found`);
  process.exit(1);
}
ok("no governed-doc contradictions found");
