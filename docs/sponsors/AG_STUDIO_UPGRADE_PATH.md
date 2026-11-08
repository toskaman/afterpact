# AG Studio upgrade path (from the Community-edition Studio)

Status: SUPERSEDED 2026-11-08 — Studio IS integrated (real canvas +
Agent Framework, `docs/sponsors/AG_GRID_STATUS.md`). What remains is the
trial-key step below, not the integration.

## Prerequisites

1. Request an AG Studio trial/Pro license (human step at ag-grid.com) and
   store the key outside the repo (env var, e.g. `AG_STUDIO_LICENSE_KEY`).
   Confirm the trial covers the judging window (Dec 1–15, 2026).
2. Add a bundler step for the web app (Vite is the documented Studio path;
   the current static host can serve `dist/` unchanged).
3. `npm install ag-studio` (+ framework adapter if the frontend migrates to
   React; the vanilla-JS Studio API works with the current SPA).

## Migration mapping (Community → Studio)

| Current (Community) | AG Studio target |
|---|---|
| `GET /api/studio/datasets` → row JSON | Keep as-is: Studio data sources. Each entity (`incidents`, `promises`, `refunds`, `captures`) becomes a Studio data view; KPIs become KPI tiles. |
| `STUDIO_COLUMNS` in `app.js` | Studio widget column configs (same fields; money formatters move to widget value formatters). |
| Promise-row click → incidents cross-filter | Studio cross-filtering between widgets (native; delete the manual chip code). |
| App CSS vars → `--ag-*` overrides | Studio theming API (same palette tokens). |
| `POST /api/studio/command` (strict filter language) | Keep the endpoint as the **ground-truth fallback**, and add Studio Agent Framework tools that call it: `filter_incidents`, `filter_promises`, `show_kpis`. The LLM proposes; the deterministic endpoint executes and returns the applied-filter explanation. |
| NL example `incidents unresolved refunds >$100` | Agent Framework demo prompt; assert the produced filter equals the endpoint's parse (add a test comparing both paths). |

## Agent Framework wiring sketch

- Harness holds the conversation; app supplies its own LLM (Studio ships
  no models/backends).
- Custom front agent (e.g. "Analyst") with read-only tools over
  `/api/studio/*`; a `delegate_to` to Studio's built-in lead agent for
  dashboard edits (add_widget / configure_widget / add_widget_filter).
- Every agent-placed widget must render data from `/api/studio/datasets`
  (add a test: widget data source URLs ⊆ allowlist; no static fixtures).

## Acceptance checklist (before claiming AG Studio)

- [ ] License key present in the deployed env, no watermark on the demo URL
- [x] Dashboards render the same live rows as `/api/studio/datasets`
- [x] Agent prompt produces a real widget from live rows (13-turn loop,
  `studio-agent-trace.png`, $0.023) — supersedes the old NL-parity box
- [x] `/api/config` `features.agStudio` flipped to `ag-studio` + test updated
- [x] UI badge `AG STUDIO: NOT CLAIMED` removed; docs updated
- [x] Trial/pro license terms reviewed for public-repo + hosted-demo use
  (commercial bundle vendored with LICENSE.html; trial = documented
  evaluation path, full license needed for production)

## References

- AG Studio JS quick start / install: https://www.ag-grid.com/studio/javascript/quick-start/
- Studio Agent Framework: https://www.ag-grid.com/studio/javascript/ai/
- License install: https://www.ag-grid.com/studio/javascript/licence-install/

## OMEGA-6 investigation record (2026-11-08, verified)

Prize: "Best Use of AG Grid" (AG Grid's blog: "Best Use of AG Studio") —
1st $5,000 / 2nd $2,000 / 3rd x3 $1,000. Sponsor pages promise free access:
45-day trial licence + a PayPal+AG Grid boilerplate repo.

Verified facts (all reproduced locally, nothing assumed):

- `ag-studio@3.1.0` (npm, license Commercial) ships a UMD bundle
  `dist/umd/ag-studio.min.js` (6.4 MB) exposing global `agStudio` with
  `createStudio`, `AgStudioAiModule`, `AgStudioLicenseManager`,
  `directLlmRunner`/`clientToolRunner`, `createAiHarness`. No bundler
  required: a `<script>` tag works in the current static SPA.
- Unlicensed behavior is **fully functional with watermark**: "All AG Studio
  Core features are unlocked for trial… email info@ag-grid.com for a trial
  license key" (console + on-canvas "AG Studio / For Trial Use Only").
  Proof: `docs/demo/screenshots/studio-unlicensed-probe.png` (Edge headless,
  zero page errors, render ok).
- Agent Framework path for vanilla JS: `directLlmRunner({ adapter, … })` —
  "You bring a model. Studio owns everything else." The `AgLlmAdapter`
  contract (`executeTurn(request, options) → { stream, complete }`) maps
  cleanly onto our OpenAI-compatible Vultr endpoint via a small server
  proxy `POST /api/ai/studio-turn` (key stays server-side, cost caps apply).
  Reference pattern: AG Grid's PayPal+Studio session post
  (blog/build-a-payments-dashboard-without-building-a-dashboard) — server
  flattens API rows, browser only sees rows; OpenAI adapter pointed at own
  `/api/ai` proxy.
- Trial licence mechanics: 45-day key via web form removes watermark and
  console warnings; licence types include STUDIO-PRO-AI. Key is installed
  client-side (`AgStudioLicenseManager.setLicenseKey`) — public by nature
  in the bundle, but must stay OUT OF GIT (deploy-time env
  `AG_STUDIO_LICENSE_KEY`, served via `/api/config` like other presence
  flags).
- Vendoring done: `npm run vendor:ag-studio` pins bytes by sha256
  (`9b83bf50…24ecc`) into `apps/web/public/vendor/` with the commercial
  `LICENSE.html`, mirroring the AG Grid Community flow. Commercial
  redistribution of the trial bundle for the hackathon demo is the
  documented evaluation path; full licence needed for production use.

Owner action required (human, ~5 min, blocks only the watermark removal):

1. Complete the 45-day trial form at
   https://www.ag-grid.com/studio/javascript/enterprise-licence/#request-a-45-day-trial-licence
   (confirm the trial covers the Dec 1–15, 2026 judging window).
2. Save the key in `APIS.txt` and local `.env` as `AG_STUDIO_LICENSE_KEY`
   (never commit). Tell the agent — integration continues watermarked
   meanwhile.

Remaining integration slices (no owner action needed):

- A. Licence plumbing (`AG_STUDIO_LICENSE_KEY` → `/api/config` →
  `setLicenseKey`) + `/studio` view hosts the Studio canvas fed by live
  `/api/studio/datasets` rows + prebuilt report + theme match.
- B. Vultr `AgLlmAdapter` + `POST /api/ai/studio-turn` proxy with caps +
  `AgStudioAiModule` chat; verify an NL prompt creates a real widget from
  live data (the sponsor acceptance test).
- C. Flip `features.agStudio` to `ag-studio`, update badges/docs/tests,
  redeploy, record the demo clip.
