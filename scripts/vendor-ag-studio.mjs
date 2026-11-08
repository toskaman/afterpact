#!/usr/bin/env node
/* Re-vendor the AG Studio UMD bundle + commercial license into
 * apps/web/public/vendor/. Idempotent: skips the download when the pinned
 * version marker already matches.
 *
 * AG Studio is a COMMERCIAL product (license: Commercial). This script pins
 * the exact bytes we ship; running the demo without a licence key shows the
 * AG watermark. A 45-day trial key (see docs/sponsors/ag-studio-trial.md)
 * removes it. Never commit a licence key.
 *
 * Usage: npm run vendor:ag-studio
 */
"use strict";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VERSION = "3.1.0";
const EXPECTED_SHA256 = "9b83bf50eaf0a21eeb1f78b10e06f237673788c4453907572f4c4d604b324ecc";
const VENDOR_DIR = new URL("../apps/web/public/vendor/", import.meta.url);
const BUNDLE = new URL("../apps/web/public/vendor/ag-studio.min.js", import.meta.url);

function sha256Of(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (existsSync(BUNDLE)) {
  const digest = sha256Of(BUNDLE);
  if (digest === EXPECTED_SHA256) {
    console.log(`vendor: ag-studio@${VERSION} already vendored (sha256 verified).`);
    process.exit(0);
  }
  console.log("vendor: existing bundle differs from the pinned build; re-vendoring.");
}

const work = join(tmpdir(), `afterpact-studio-vendor-${Date.now()}`);
mkdirSync(work, { recursive: true });
console.log(`vendor: packing ag-studio@${VERSION} in ${work}`);
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const shell = process.platform === "win32";
execFileSync(npmBin, ["pack", `ag-studio@${VERSION}`], { cwd: work, stdio: "inherit", shell });
execFileSync("tar", ["-xzf", `ag-studio-${VERSION}.tgz`], { cwd: work, stdio: "inherit", shell });
const bundleSrc = join(work, "package", "dist", "umd", "ag-studio.min.js");
const licenseSrc = join(work, "package", "LICENSE.html");
const digest = sha256Of(bundleSrc);
if (digest !== EXPECTED_SHA256) {
  throw new Error(`sha256 mismatch: got ${digest}, expected ${EXPECTED_SHA256}. Refusing to vendor.`);
}
mkdirSync(VENDOR_DIR, { recursive: true });
copyFileSync(bundleSrc, BUNDLE);
copyFileSync(licenseSrc, new URL("../apps/web/public/vendor/ag-studio.LICENSE.html", import.meta.url));
console.log(`vendor: ag-studio@${VERSION} vendored (sha256 ${digest}).`);
