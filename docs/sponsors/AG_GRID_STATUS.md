# AG Grid status — Commerce Intelligence Studio (AG Studio + Community)

Date: 2026-11-08. Authoritative for the question "did this project use AG Grid / AG Studio?"

## Short answer

- **AG Studio 3.1.0 (Commercial, trial): USED.** The `#/studio` view hosts a
  real AG Studio canvas (official CDN, SHA-256 pinned + SRI, commercial
  license filed, no bytes committed) over the live
  promises/incidents/captures/refunds datasets, with
  the real Agent Framework loop driven by our own Vultr-backed LLM adapter
  (`POST /api/ai/studio-turn`, key server-side). Verified live: an NL
  prompt produced a configured bar chart from live rows
  (`docs/demo/screenshots/studio-agent-trace.png`). Since TITAN VI
  (2026-11-09) the harness declares a custom **Outcome Risk Analyst**
  agent (`directLlmRunner`) with three read-only custom tools
  (`api.defineAiTool`) over the same live datasets — see
  `docs/demo/AG_GRID_AGENT_DEMO.md`. Trial key AG-151025 (Pro Enterprise
  eval-only, expires 2026-12-24) installed 2026-11-09 via deploy-time env;
  the canvas shows `AG STUDIO · LICENSED`
  (`docs/demo/screenshots/studio-licensed.png`).
- **AG Grid Community 36.3.0 (MIT): USED.** The same view keeps real
  Community tables below the canvas (vendored UMD, SHA-256 pinned), with
  custom KPI widgets, app theming, cross-filtering, and a strict NL
  command box over real dashboard state.

## What was built (Community)

| Requirement (from prize plan) | Implementation | Evidence |
|---|---|---|
| Embedded dashboards over real data | `GET /api/studio/datasets` — KPIs + promises/incidents/refunds/captures rows built from live store state | `apps/api/src/studio.ts`, `#/studio` |
| Custom widgets | KPI tiles, incident-mix breakdown bars, refund-rate stat | `apps/web/public/app.js` (`renderStudio`) |
| Theming | AG Grid quartz theme bound to app CSS vars; follows dark/light toggle | `apps/web/public/styles.css` (`.ag-theme-quartz*`) |
| Cross-filter | Click a promise row → incidents grid filters to that promise, with a visible chip + clear | `renderStudioGrid` in `app.js` |
| NL mods of real state | `POST /api/studio/command` — deterministic filter language, e.g. `incidents unresolved refunds >$100`; unknown tokens rejected with hints, never silently ignored | `parseStudioCommand` / `applyStudioCommand` in `studio.ts` |
| Not a static mockup | Datasets asserted against API-seeded state; flagship Act 9 regenerates the Studio from live data | `tests/integration/sponsors.studio.timeline.test.ts`, Act 9 in `apps/api/src/demo.ts` |
| Licensed cleanly | MIT bundle vendored with license file + pinned SHA-256 + reproduce script | `apps/web/public/vendor/`, `scripts/vendor-ag-grid.mjs` |
| Degrades honestly | If the bundle is missing, native tables render with a `NATIVE TABLE FALLBACK` badge | `renderStudioGrid` fallback branch |

## AG Studio licensing posture (updated 2026-11-09)

The "Why not AG Studio" evaluation below is superseded: Studio IS used
(see Short answer). Current posture:

- **No redistribution.** The commercial UMD bytes are NOT committed to
  this MIT repo. The browser loads the SHA-pinned build from the official
  AG Grid CDN first; a build-time-fetched local copy (`npm run
  vendor:ag-studio`, gitignored) is fallback only. EULA text is filed for
  attribution at `apps/web/public/vendor/ag-studio.LICENSE.html` with a
  carve-out in `LICENSE` + `ag-studio.NOTICE.txt`.
- **Trial key installed (2026-11-09).** AG-151025 Pro Enterprise
  eval-only key via deploy-time env (never committed); expiry
  2026-12-24 covers the Dec 1–15 judging window by the key's own terms.
  `AG STUDIO · LICENSED` verified by screenshot.
- **Consent request sent, reply pending.** The owner sent the written-
  consent request by email on 2026-11-09 (draft + record in
  `docs/sponsors/ag-studio-trial.md`); no reply yet, so redistribution
  consent is NOT yet granted and the Community fallback stays armed.
- **Prize intent: pursue Best Use of AG Grid** (official Devpost name;
  AG Grid's blog calls it "Best Use of AG Studio") as the single sponsor
  prize, on genuine usage (real canvas + real Agent Framework over live
  data). If consent is declined, the entry falls back to the honestly
  labeled Community edition before judging.

## Prize implication

The AG Grid sponsor prize is "Best Use of AG Grid" (rules audit
§Sponsor criteria). With real Studio usage plus the Community
foundation, the entry claims this prize; the Studio also strengthens the
Grand-prize case (Technological Implementation + Design).

## Custom agent — Outcome Risk Analyst (TITAN VI, 2026-11-09)

- Custom agent `outcome-risk-analyst` declared via `directLlmRunner`
  with AFTERPACT instructions; primary agent of a custom harness
  (`createAiHarness` setup form) with the Studio built-ins it needs
  (`viewSchema`, `viewPage`, `executeQuery`, `addWidget`) plus three
  custom tools. Falls back to the base harness if any API is missing —
  never half-wired.
- Custom tools (`api.defineAiTool`, client-executed, schema-validated
  params): `get_incident_exposure` (incidents by unrefunded exposure),
  `get_promise_outcome_comparison` (promised vs observed + evidence
  coverage), `get_refund_verification_status` (refunds by verification
  state + remaining capture balances). All read-only GETs to the single
  allowlisted endpoint `GET /api/studio/datasets`; row caps, status
  allowlist, abort-signal forwarding, fail-closed errors.
- Prompt starter added: "Outcome risk briefing".
- Keyless proof the custom path wins against the real 3.1.0 bundle:
  `tests/e2e/studio.e2e.ts` asserts
  `data-harness-kind="outcome-risk-analyst"` on the mounted canvas.
- Tool behavior proof (hermetic, no bundle/key):
  `tests/unit/studio-risk-tools.test.ts` (7 tests: ranking, caps,
  filters, fail-closed, no-mutation tripwire, instruction bounds).
- Honest limit: a live keyed agent trace exercising the new tools is
  still an owner action (inference key required); the committed
  `studio-agent-trace.png` covers the base harness loop. Full demo
  script: `docs/demo/AG_GRID_AGENT_DEMO.md`.

## Files

- `apps/api/src/studio.ts` — datasets + NL command language
- `apps/web/public/{index.html,app.js,styles.css}` — Studio view + theme
- `apps/web/public/ag-studio-risk-tools.js` — custom tools + analyst instructions
- `apps/web/public/ag-studio-adapter.js` — Vultr-backed LLM adapter
- `apps/web/public/vendor/` — pinned AG Grid Community bundle + MIT license
- `scripts/vendor-ag-grid.mjs` — reproduce/verify vendoring
- `tests/integration/sponsors.studio.timeline.test.ts` — dataset/NL/vendor tests
- `tests/unit/studio-risk-tools.test.ts` — custom-tool behavior + security bounds
