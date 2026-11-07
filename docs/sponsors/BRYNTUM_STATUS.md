# Bryntum status — Recovery Operations Timeline (fallback renderer)

Date: 2026-11-07. Authoritative for "did this project use Bryntum?"

## Short answer

- **Bryntum Gantt/Scheduler/Calendar: NOT used, NOT claimed.** No Bryntum
  package, trial, or license exists in this build. The UI badge reads
  `FALLBACK TIMELINE`, and `/api/config` reports `bryntum: fallback-timeline`.
- **Recovery Operations Timeline: BUILT as a documented fallback.**
  `GET /api/timeline?promiseId=…` computes a dependency-aware schedule
  from live promise state, rendered as SVG at `#/timeline`.

## What the fallback does (real behavior, not animation)

`apps/api/src/timeline.ts` (`buildTimeline`, pure + tested) emits tasks
for every required concern, each with window, status, dependencies,
origin, and a human note:

- payment capture window (blocked until approval)
- expected delivery (from the promise; **shifts when an incident lands**)
- evidence deadline (follows delivery)
- merchant response window (opens on incident, closes on proposal)
- customer notification
- incident-response chain (inserted only when an incident exists)
- refund approval (blocked until a proposal exists; done on decision)
- settlement verification (tracks the refund record)
- resolution roll-up (after a proposal)
- escalation review (armed by critical/high open incidents)

**Dependency-aware rescheduling:** the first open incident injects a
category-based slip (`not-delivered` +7d, `late-delivery` +3d, …),
shifts delivery/evidence/settlement, and stamps each shifted task with
`shiftedByIncident: {incidentId, baselineEnd, daysShifted, reason}`.
Verified by tests that snapshot the baseline, raise an incident, and
assert the shift (`tests/integration/sponsors.studio.timeline.test.ts`).

## Why not Bryntum proper

1. **License fit.** The 45-day trial (`@bryntum/gantt-trial`, verified on
   npm) is granted for internal evaluation; embedding it in a public repo
   + public judging demo exceeds that grant, and the prize plan forbids
   improper redistribution of licensed files.
2. **Prize-plan priority.** Bryntum is the designated first cut (P1):
   "cut first if the core slips". The core + higher-leverage sponsors
   (Channel3 live path, AG Grid tables, Render deploy) consumed the window.
3. **Honesty.** The fallback is labeled as a fallback everywhere; no
   Bryntum prize is claimed.

## Upgrade path

When a proper license is available, follow
`docs/sponsors/BRYNTUM_UPGRADE_PATH.md`: the timeline JSON maps 1:1 to
Bryntum Gantt tasks/dependencies, and the same tests re-run against the
Bryntum renderer (baseline → incident → assert shifted tasks).

## Files

- `apps/api/src/timeline.ts` — schedule computation
- `apps/api/src/ops.ts` — `timelineFor`
- `apps/api/src/routes.ts` — `GET /api/timeline`
- `apps/web/public/app.js` — `#/timeline` SVG renderer (`timelineSvg`)
- `apps/web/public/styles.css` — `.tl-*` styles
