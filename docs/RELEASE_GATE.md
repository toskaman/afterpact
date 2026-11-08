# AFTERPACT release gate

Date: 2026-11-07, addendum 2026-11-08. Verdicts: **PASS** (executed +
green), **FAIL** (red), **NOT VERIFIED** (real path, unexecuted — needs
creds/humans), **NOT PURSUED** (deliberately out of scope, with a filed
non-claim). No gate is PASS on an unexecuted path.

> 2026-11-08 addendum: rows 1, 2, 5, 6, 11, 14, 16 and residual risks
> updated to current verified truth (see
> `docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json`). The 2026-11-07 run
> below is history; current numbers supersede it.

## Gates

| # | Gate | Verdict | Evidence |
|---|---|---|---|
| 1 | Full test suite green | **PASS** | 2026-11-08: `vitest run` → 26 files passed, 4 skipped files; **281 passed, 33 skipped** (skips = keyless live probes + live evals). CI `verify`+`e2e`+`drift` green at HEAD (four intermediate pushes failed on a smoke expectation since corrected at `ca51497`). |
| 2 | Strict typecheck zero | **PASS** | `tsc --noEmit` over domain + policy + payments + ai + api + tests (6 projects), exit 0, locally and in CI. |
| 3 | Frontend syntax | **PASS** | `node --check apps/web/public/app.js`, exit 0. |
| 4 | Flagship repro (mock) | **PASS** | `POST /api/demo/run flagship` → `completed`, 9 acts; Act 9 `passed/real-api` (Studio regeneration); audited via vitest + compiled-server smoke + CI smoke. |
| 5 | Clean-install check | **PASS** | CI/Ubuntu is authoritative: `npm ci` → typecheck → 281+33 tests → `npm run build` → `npm run vendor:ag-studio` → compiled-server flagship smoke → Playwright E2E, all green. SMB-share `npm ci` remains unrepresentative (ENOTSUP symlinks). |
| 6 | Studio = real data | **PASS** | Datasets built from live store state and asserted against API-seeded fixtures; strict NL language (`incidents unresolved refunds >$100`) with rejection+hints; AG Grid Community 36.3.0 vendored (SHA-256 pinned, MIT license filed, `scripts/vendor-ag-grid.mjs` verifies). AG Studio 3.1.0 IS used: real canvas + Agent Framework over live data, official-CDN-first loading (no commercial bytes committed) — see `docs/sponsors/AG_GRID_STATUS.md`. |
| 7 | Channel3 live path | **PASS (live call + artifact)** | Client + normalization + comparison + attribution + failure isolation implemented and tested; unconfigured status + HTTP 503 verified over HTTP; Act 2 fallback verified. Keyed live `POST /v1/search` executed 2026-11-08 ("mechanical keyboard", 3 candidates, 1187 ms, origin `channel3-live`); redacted report committed at `docs/sponsors/channel3-live-report.json`, pinned by `channel3.report.test.ts`, manifest `channel3Live.grade=artifact`. |
| 8 | APIMatic | **NOT PURSUED** | Plugin never installed/used; affirmative non-claim in `docs/sponsors/APIMATIC_EVIDENCE.md`. Prize not claimed. |
| 9 | Bryntum | **PASS (fallback) / NOT PURSUED (Bryntum proper)** | Dependency-aware timeline recomputed from live state (incident shifts asserted in tests); labeled `FALLBACK TIMELINE`; upgrade path documented. No Bryntum package/license in the build; prize not claimed. |
| 10 | Hosted demo | **PASS (Vultr)** | Render NOT pursued (requires a credit card the owner doesn't have; `render.yaml` kept as reference). Live instead on Vultr VPS Paris: `https://199.247.9.188.nip.io` (Caddy + production LE cert, mock transport, no secrets on box). Verified 2026-11-07: `/api/health` ok + remote flagship `completed` (9 acts). See `docs/demo/VULTR_HOSTING.md`. |
| 11 | Postman collection | **PASS (executed)** | `postman/AFTERPACT.postman_collection.json`: 10 folders, 38 requests (auth helper, positive, idempotency, negatives, exact error codes). Newman execution verified: 37/37 requests, 18/18 assertions, 0 failed (`postman/newman-report.json`). |
| 12 | Docs pack | **PASS** | README (problem, differentiation, PayPal, AI, real-vs-simulated, install, test, flagship repro, proofs, sponsors, limitations), SECURITY.md, CONTRIBUTING.md, `docs/demo/DEMO_SCRIPT.md` (+<3-min shot list), `docs/hackathon/SUBMISSION_CHECKLIST.md`, `docs/benchmarks/IMPACT_BENCHMARK.md` (one machine-recorded row). |
| 13 | No secrets in repo | **PASS** | `.env` untracked/absent; `.env.example` placeholders; Postman vars placeholder; key-material scan over README/SECURITY/CONTRIBUTING/render.yaml/collection/channel3 client clean; status endpoints return presence booleans only (tested). |
| 14 | License / OSS | **PASS** | MIT `LICENSE` with AG Studio commercial carve-out; runtime dep `zod` MIT; vendored AG Grid Community MIT with license file; AG Studio EULA + notice filed, commercial bytes NOT committed (official-CDN-first, build-time fallback); no Bryntum trial in the build. |
| 15 | Live-sandbox flagship | **PASS** | Full live loop completed 2026-11-07: order **2ER387580K033722V** → personal-buyer approval → capture **7R158417X9367771B** → incident (3 ordered/2 delivered) → partial refund **8DJ895035B173303G** (12999 USD, `succeeded`) → Flight Recorder 10 entries chain-VALID → Studio regenerated. Re-verified 2026-11-08 via keyed GETs (order COMPLETED, capture PARTIALLY_REFUNDED 38997, refund COMPLETED 12999); receipts pinned in `docs/demo/paypal-live-receipts.json` (manifest `paypalLiveLoop.grade=artifact`). Fixed en route: live POST-refund responses omit `amount` (schema now optional + requested/GET fallback; regression tests in `paypal.safety`). Sandbox residue (honest test activity): abandoned orders 4FH32915JA251353Y, 1SS55763A9401112G; $129.99 + 2×$1.00 test refunds on capture 8TD21520AM101025D. |
| 16 | Demo video + hosted URL | **PARTIAL** | Hosted URL DONE (Vultr, gate 10). Video NOT DONE (owner step): record <3-min video (shot list ready), paste URL into README + Devpost. |

## Bugs found and fixed during this gate

1. `package-lock.json` out of sync with workspaces — `npm ci` failed
   with EUSAGE. Regenerated on a symlink-capable FS and synced back;
   clean-install re-verified.
2. Studio NL tokenizer rejected the flagship example (`>$100` attached
   op). Parser now splits attached/fused operators; covered by tests.
3. Discovery bad-payload test could not fail (all-optional loose schema
   accepts `{}`-shapes). Test now uses a non-object payload; client
   behavior (empty → zero candidates) kept and documented.
4. Test-only type errors (`.catch` union widening) failed `tsc -p tests`.
   Fixed with a typed rejection helper.
5. Developer Center labeled the Community value as "AG Studio analytics".
   Relabeled to name the exact implementation.

## Deliberate contract changes (existing tests updated)

- `apps.api.test.ts` "labels not-in-build…" → "labels sponsor
  integrations honestly": asserts the new exact labels
  (`ag-grid-community` / `unconfigured` / `fallback-timeline`).
- Flagship Act 9 assertion `not-in-build` → `passed/real-api` (Studio
  regeneration is now real); Act 2 asserts the honest keyless fallback.
- `apps/api/src/demo.ts` Acts 2 + 9 upgraded to the real discovery and
  Studio surfaces (same Ops methods as the routes; no parallel demo path).

## Post-gate fix (2026-11-07, after screenshots)

- Header + Developer Center read `health.chainValid`, but `/api/health`
  returns `auditChainValid` (contract locked by `apps.api.test.ts`), so
  the UI showed a permanent false "CHAIN BROKEN". Fixed in
  `apps/web/public/app.js` (2 read sites); regression test added in
  `tests/integration/frontend.contract.test.ts` (every `health.*` read
  must exist in the live payload). Suite now 156 passed + 1 skipped;
  re-captured UI shows "CHAIN VALID · 13" with 0 console errors.
- Suspected `/vendor/ag-grid-community.min.js` 404 investigated and
  refuted: GET returns 200 (1.88 MB). Earlier 404s were a HEAD-method
  probe artifact plus one tx-API 404 from the screenshot script passing
  a wrong id (script fixed to use the promise id).

## Residual risks for the orchestrator

- ~~JURY_EVIDENCE_MATRIX.md still reads all-TBD~~ — resolved 2026-11-08
  (matrix filled with verified evidence).
- `prompt.txt` (build instructions) ships in the repo root — decide
  whether it stays for the public submission.
- ~~No `git` repo initialized yet~~ — resolved: public repo
  `toskaman/afterpact`, `main`, CI green.
