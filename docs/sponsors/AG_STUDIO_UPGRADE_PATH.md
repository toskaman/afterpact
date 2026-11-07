# AG Studio upgrade path (from the Community-edition Studio)

Status: NOT IMPLEMENTED — this is the executable plan a maintainer follows
when an AG Studio (Pro with AI) license is available. Nothing here is
claimed as done.

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
- [ ] Dashboards render the same live rows as `/api/studio/datasets`
- [ ] NL prompt from the flagship demo reproduces the endpoint result
- [ ] `/api/config` `features.agStudio` flipped to `ag-studio` + test updated
- [ ] UI badge `AG STUDIO: NOT CLAIMED` removed; docs updated
- [ ] Trial/pro license terms reviewed for public-repo + hosted-demo use

## References

- AG Studio JS quick start / install: https://www.ag-grid.com/studio/javascript/quick-start/
- Studio Agent Framework: https://www.ag-grid.com/studio/javascript/ai/
- License install: https://www.ag-grid.com/studio/javascript/licence-install/
