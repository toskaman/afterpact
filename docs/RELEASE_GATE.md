# AFTERPACT release gate

Date: 2026-11-07. Verdicts: **PASS** (executed + green), **FAIL** (red),
**NOT VERIFIED** (real path, unexecuted — needs creds/humans),
**NOT PURSUED** (deliberately out of scope, with a filed non-claim).
No gate is PASS on an unexecuted path.

## Gates

| # | Gate | Verdict | Evidence |
|---|---|---|---|
| 1 | Full test suite green | **PASS** | `node node_modules/vitest/vitest.mjs run` → 14 files passed, 1 skipped file; **155 passed, 1 skipped** (skip = live-sandbox probe, no creds). Same result in the isolated clean copy. |
| 2 | Strict typecheck zero | **PASS** | `tsc --noEmit` over domain + policy + payments + api + tests, exit 0 (workspace and clean copy). |
| 3 | Frontend syntax | **PASS** | `node --check apps/web/public/app.js`, exit 0. |
| 4 | Flagship repro (mock) | **PASS** | `POST /api/demo/run flagship` → `completed`, 9 acts; Act 9 `passed/real-api` (Studio regeneration); audited via vitest + compiled-server smoke + CI smoke. |
| 5 | Clean-install check | **PASS** | Isolated copy (`$TEMP/afterpact-clean`, excluded node_modules/dist/data): `npm ci` → typecheck → 155+1 tests → `npm run build` → compiled-server flagship smoke, all green. **Fix applied:** `package-lock.json` was out of sync with workspaces (`npm ci` EUSAGE); regenerated on NTFS and synced back. SMB-share `npm ci` remains unrepresentative (ENOTSUP symlinks) — CI/Ubuntu is authoritative. |
| 6 | Studio = real data | **PASS** | Datasets built from live store state and asserted against API-seeded fixtures; strict NL language (`incidents unresolved refunds >$100`) with rejection+hints; AG Grid Community 36.3.0 vendored (SHA-256 `5fc8736c…`, MIT license filed, `scripts/vendor-ag-grid.mjs` verifies). AG Studio explicitly NOT claimed. |
| 7 | Channel3 live path | **PASS (fail-closed) / NOT VERIFIED (live call)** | Client + normalization + comparison + attribution + failure isolation implemented and tested against stubbed fetch; unconfigured status + HTTP 503 verified over HTTP; Act 2 fallback verified. A real `POST /v1/search` against `api.trychannel3.com` was **never executed** (no API key in this environment). Set `CHANNEL3_API_KEY` and re-run Act 2 / `#/discovery` before claiming live usage on video. |
| 8 | APIMatic | **NOT PURSUED** | Plugin never installed/used; affirmative non-claim in `docs/sponsors/APIMATIC_EVIDENCE.md`. Prize not claimed. |
| 9 | Bryntum | **PASS (fallback) / NOT PURSUED (Bryntum proper)** | Dependency-aware timeline recomputed from live state (incident shifts asserted in tests); labeled `FALLBACK TIMELINE`; upgrade path documented. No Bryntum package/license in the build; prize not claimed. |
| 10 | Render deploy | **PASS (config) / NOT DONE (live URL)** | `render.yaml` Blueprint + `.github/workflows/ci.yml` in repo; health endpoint verified. Applying the Blueprint and pasting the live URL are human steps (no Render account here). |
| 11 | Postman collection | **PASS (schema + path coverage)** | `postman/AFTERPACT.postman_collection.json`: 10 folders, 38 requests (auth helper, positive, idempotency, negatives, exact error codes); JSON-valid. Every local path is covered by vitest; execution inside Postman itself NOT VERIFIED (no Newman here). |
| 12 | Docs pack | **PASS** | README (problem, differentiation, PayPal, AI, real-vs-simulated, install, test, flagship repro, proofs, sponsors, limitations), SECURITY.md, CONTRIBUTING.md, `docs/demo/DEMO_SCRIPT.md` (+<3-min shot list), `docs/hackathon/SUBMISSION_CHECKLIST.md`, `docs/benchmarks/IMPACT_BENCHMARK.md` (one machine-recorded row). |
| 13 | No secrets in repo | **PASS** | `.env` untracked/absent; `.env.example` placeholders; Postman vars placeholder; key-material scan over README/SECURITY/CONTRIBUTING/render.yaml/collection/channel3 client clean; status endpoints return presence booleans only (tested). |
| 14 | License / OSS | **PASS** | MIT `LICENSE`; runtime dep `zod` MIT; vendored AG Grid Community MIT with license file; no proprietary/trial binaries redistributed (no AG Studio, no Bryntum trial). |
| 15 | Live-sandbox flagship | **NOT VERIFIED** | `awaiting-action` buyer-approval path implemented but unexecuted (no PayPal creds). Verify manually with sandbox keys before the video. |
| 16 | Demo video + hosted URL | **NOT DONE** | Human steps: record <3-min video (shot list ready), apply Render Blueprint, paste URLs into README + Devpost. |

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

- JURY_EVIDENCE_MATRIX.md still reads all-TBD (sibling scope; this gate
  does not update it).
- `prompt.txt` (build instructions) ships in the repo root — decide
  whether it stays for the public submission.
- No `git` repo initialized yet (deferred by prior agents — orchestrator step).
