# AG Grid status — Commerce Intelligence Studio (AG Studio + Community)

Date: 2026-11-08. Authoritative for the question "did this project use AG Grid / AG Studio?"

## Short answer

- **AG Studio 3.1.0 (Commercial, trial): USED.** The `#/studio` view hosts a
  real AG Studio canvas (vendored UMD, SHA-256 pinned, commercial license
  filed) over the live promises/incidents/captures/refunds datasets, with
  the real Agent Framework loop driven by our own Vultr-backed LLM adapter
  (`POST /api/ai/studio-turn`, key server-side). Verified live: an NL
  prompt produced a configured bar chart from live rows
  (`docs/demo/screenshots/studio-agent-trace.png`). Trial watermark shows
  until `AG_STUDIO_LICENSE_KEY` is installed (owner action documented in
  `AG_STUDIO_UPGRADE_PATH.md`).
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

## Why not AG Studio

AG Studio (`ag-studio` on npm, verified v3.1.0) was evaluated against docs
at ag-grid.com/studio:

1. **License gate.** Studio runs unlicensed only for local testing
   (watermark + console warnings). A production/judging demo needs a trial
   license (human registration), and the AI Assistant / Agent Framework
   path needs an **AG Studio Pro with AI** license. Neither is obtainable
   autonomously, and a watermarked judging demo would violate the
   "functional demo" quality bar.
2. **Stack fit.** This build is a zero-build static frontend; Studio is an
   npm component that expects a bundler workflow. The integration risk
   inside the submission window exceeded the prize value versus a working
   Community edition.
3. **Honesty.** Claiming "Best Use of AG Studio" without Studio would be a
   disqualification-grade misrepresentation. The Community edition is
   labeled exactly as such everywhere.

## Prize implication

The AG Grid sponsor prize is judged as "Best Use of AG Studio" (rules
audit §Sponsor criteria). With Community-only usage, an AG Grid sponsor
win is **unlikely**; the Studio still strengthens the Grand-prize case
(Technological Implementation + Design) and keeps the AG Studio upgrade
path executable — see `AG_STUDIO_UPGRADE_PATH.md`.

## Files

- `apps/api/src/studio.ts` — datasets + NL command language
- `apps/web/public/{index.html,app.js,styles.css}` — Studio view + theme
- `apps/web/public/vendor/` — pinned AG Grid Community bundle + MIT license
- `scripts/vendor-ag-grid.mjs` — reproduce/verify vendoring
- `tests/integration/sponsors.studio.timeline.test.ts` — dataset/NL/vendor tests
