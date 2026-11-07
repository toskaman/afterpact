# Bryntum upgrade path (from the fallback timeline)

Status: NOT IMPLEMENTED — executable plan for when a Bryntum license
covering a public repo + hosted demo is available.

## Prerequisites

1. Obtain a license whose terms cover public-repo distribution and a
   public judging demo (the 45-day evaluation trial does not; confirm in
   writing before embedding).
2. `npm install @bryntum/gantt` (licensed package, NOT the `-trial`
   alias) + theme CSS, per https://bryntum.com/docs (npm repository guide).
3. Add a bundler step for the web app (Vite; the static host serves `dist/`).

## Migration mapping (fallback → Gantt)

| Current (fallback) | Bryntum Gantt target |
|---|---|
| `GET /api/timeline` tasks `{id, label, start, end, dependsOn}` | `TaskModel` fields map 1:1 (`name` ← label; dates pass through) |
| `status` (`done/active/upcoming/overdue/blocked`) | `percentDone` + `cls` rules (done→100%, blocked→unscheduled-style) |
| `shiftedByIncident` | Keep in `taskData`; render with a Gantt task renderer (dashed bar + tooltip with baseline vs shifted) |
| Dependency edges | Gantt `dependencies` store (type EndToStart); the SVG elbow code is deleted |
| `#/timeline` task table + notes | Keep as the accessible text alternative below the Gantt |
| `origin: real-api/computed-schedule` | Keep in tooltips; add `bryntum-gantt` origin pill |

## Acceptance checklist (before claiming Bryntum)

- [ ] License covers public repo + hosted demo (evidence filed, not assumed)
- [ ] Same incident → same shifts as the fallback (re-run timeline tests
      against Gantt-projected tasks; dependency graph asserted, not just pixels)
- [ ] Incident arriving mid-demo re-renders dependencies without reload
- [ ] `/api/config` `features.bryntum` flipped to `bryntum-gantt` + test updated
- [ ] `FALLBACK TIMELINE` badge removed; docs updated

## References

- Trial vs licensed npm packages: https://bryntum.com/docs (guide → npm repository → installation)
- Trial EULA (45-day, internal evaluation): `@bryntum/scheduler-vue-3/license.pdf` on jsDelivr
