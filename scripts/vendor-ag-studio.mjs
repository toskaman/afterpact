#!/usr/bin/env node
/* Fetch the AG Studio UMD bundle from the OFFICIAL AG Grid distribution
 * channel into apps/web/public/vendor/ (build-time artifact, gitignored).
 *
 * AG Studio is a COMMERCIAL product. Its EULA forbids redistribution, so the
 * bundle bytes are NOT committed to this MIT-licensed repo; every build
 * re-fetches the pinned version and verifies its SHA-256 before use. The
 * browser loader prefers the official CDN and uses this local copy only as
 * a fallback (offline judges, deterministic CI).
 *
 * Official source: https://cdn.jsdelivr.net/npm/ag-studio@3.1.0/dist/umd/ag-studio.min.js
 * (per https://www.ag-grid.com/studio/javascript/installation/).
 * The commercial licence text is filed at
 * apps/web/public/vendor/ag-studio.LICENSE.html (tracked, attribution only).
 *
 * Running the demo without a licence key shows the AG watermark. A trial
 * key (see docs/sponsors/ag-studio-trial.md) removes it. Never commit a
 * licence key.
 *
 * Usage: npm run vendor:ag-studio
 */
"use strict";

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VERSION = "3.1.0";
const CDN_URL = `https://cdn.jsdelivr.net/npm/ag-studio@${VERSION}/dist/umd/ag-studio.min.js`;
const EXPECTED_SHA256 = "9b83bf50eaf0a21eeb1f78b10e06f237673788c4453907572f4c4d604b324ecc";
const VENDOR_DIR = new URL("../apps/web/public/vendor/", import.meta.url);
const BUNDLE = new URL("../apps/web/public/vendor/ag-studio.min.js", import.meta.url);

function sha256OfBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

if (existsSync(BUNDLE)) {
  const digest = sha256OfBytes(readFileSync(BUNDLE));
  if (digest === EXPECTED_SHA256) {
    console.log(`vendor: ag-studio@${VERSION} already fetched (sha256 verified).`);
    process.exit(0);
  }
  console.log("vendor: existing bundle differs from the pinned build; re-fetching.");
}

console.log(`vendor: fetching ${CDN_URL}`);
const response = await fetch(CDN_URL, { redirect: "follow" });
if (!response.ok) {
  throw new Error(`official CDN fetch failed: HTTP ${response.status} for ${CDN_URL}`);
}
const bytes = Buffer.from(await response.arrayBuffer());
const digest = sha256OfBytes(bytes);
if (digest !== EXPECTED_SHA256) {
  throw new Error(`sha256 mismatch: got ${digest}, expected ${EXPECTED_SHA256}. Refusing to install.`);
}
const work = join(tmpdir(), `afterpact-studio-vendor-${Date.now()}`);
mkdirSync(work, { recursive: true });
const staged = join(work, "ag-studio.min.js");
writeFileSync(staged, bytes);
mkdirSync(VENDOR_DIR, { recursive: true });
copyFileSync(staged, BUNDLE);
console.log(`vendor: ag-studio@${VERSION} installed to apps/web/public/vendor/ (sha256 ${digest}).`);
console.log("vendor: commercial EULA applies; see apps/web/public/vendor/ag-studio.LICENSE.html.");
