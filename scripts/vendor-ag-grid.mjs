#!/usr/bin/env node
/* Re-vendor the AG Grid Community UMD bundle + license into
 * apps/web/public/vendor/. Idempotent: skips the download when the pinned
 * version marker already matches.
 *
 * Usage: npm run vendor:ag-grid
 */
"use strict";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VERSION = "36.3.0";
const EXPECTED_SHA256 = "5fc8736cc0726dcd2e2901681180462fe4d1a519b31a2b4ab7268a97a52a3532";
const VENDOR_DIR = new URL("../apps/web/public/vendor/", import.meta.url);
const BUNDLE = new URL("../apps/web/public/vendor/ag-grid-community.min.js", import.meta.url);

function sha256Of(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (existsSync(BUNDLE)) {
  const source = readFileSync(BUNDLE, "utf8");
  if (source.includes(VERSION) && sha256Of(BUNDLE) === EXPECTED_SHA256) {
    console.log(`vendor: ag-grid-community@${VERSION} already vendored (sha256 verified).`);
    process.exit(0);
  }
  console.log("vendor: existing bundle differs from the pinned build; re-vendoring.");
}

const work = join(tmpdir(), `afterpact-ag-vendor-${Date.now()}`);
mkdirSync(work, { recursive: true });
console.log(`vendor: packing ag-grid-community@${VERSION} in ${work}`);
execFileSync("npm", ["pack", `ag-grid-community@${VERSION}`], { cwd: work, stdio: "inherit" });
execFileSync("tar", ["-xzf", `ag-grid-community-${VERSION}.tgz`], { cwd: work, stdio: "inherit" });
const bundleSrc = join(work, "package", "dist", "ag-grid-community.min.js");
const licenseSrc = join(work, "package", "LICENSE.txt");
const digest = sha256Of(bundleSrc);
if (digest !== EXPECTED_SHA256) {
  throw new Error(`sha256 mismatch: got ${digest}, expected ${EXPECTED_SHA256}. Refusing to vendor.`);
}
mkdirSync(VENDOR_DIR, { recursive: true });
copyFileSync(bundleSrc, BUNDLE);
copyFileSync(licenseSrc, new URL("../apps/web/public/vendor/ag-grid-community.LICENSE.txt", import.meta.url));
console.log(`vendor: ag-grid-community@${VERSION} vendored (sha256 ${digest}).`);
