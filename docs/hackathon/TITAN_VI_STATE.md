# TITAN VI — State (trust & outcome assurance)

Date: 2026-11-09 (Europe/Paris). Supersedes `TITAN_V_STATE.md` as the live
position file; TITAN V documents stay frozen as history.

## Position

- Branch: `titan-vi` (from `main` @ `5e78098`).
- HEAD at last verification: `db63963` + uncommitted drift/docs sync (see
  below); final SHAs recorded after the branch CI run, before merge.
- Working tree: governed docs + `scripts/check-docs-drift.mjs` modified,
  `scripts/drift-lib.mjs` + `tests/unit/drift.test.ts` new; nothing else.
  (`.npm-cache/` untracked, pre-existing, untouched.)
- Latest CI on `main`: run #59 (`42547352382`, verify+e2e+drift green).
- Branch CI: pending push of `titan-vi` (this file updated with the run URL).
- Deployment: `c4299fa` live on `https://199.247.9.188.nip.io`
  (mock-simulated, keyless). Redeploy of the TITAN VI code: decision at
  merge time (backup → deploy → verify, same procedure as TITAN V).
- Submission: NOT submitted. Video file built, YouTube upload owner-side.
  Devpost draft current, submit owner-side.

## Observed test results (2026-11-09, keyless, branch `titan-vi`)

- `npm run typecheck`: exit 0 (6 projects).
- `npm test`: **315 passed, 0 failed, 33 skipped** (348 total, 38 files).
  Baseline was 288/0/33; +27 from TITAN VI (hold 2, concurrency 1,
  risk-tools 7, drift 15, studio contract 1, webhook-amount regression 1).
- `npx playwright test`: **12/12** (judge 3→5 incl. Hold + mobile/keyboard).
- `node scripts/check-docs-drift.mjs`: FAIL→fix loop in progress; must be
  green before merge (currently flags exactly the intended sync items).
- Newman: 37/37 + 18/18 (unchanged artifact `postman/newman-report.json`;
  no API route changed shape — `hold` only extends the scenario enum).
- Live inference spend this mission: 1 incidental keyed probe call
  (`ai.live.test.ts`, first baseline run before keyless discipline;
  ~$0.0001). All later runs keyless. No eval re-runs.

## Sponsor status

- AG Grid (single sponsor target): Studio 3.1.0 trial USED + Community
  36.3.0 USED + NEW custom `outcome-risk-analyst` agent with 3 read-only
  tools (keyless mount asserted). Trial key: NOT installed. Consent:
  drafted, NOT sent. Judging-window coverage: UNKNOWN. Fallback cutoff:
  Nov 11 EOD (`AG_STUDIO_DISABLED=1`, tested). Owner actions unchanged.
- Channel3 / others: filed non-claims stand (no prize pursued).

## Owner-only blockers (unchanged from TITAN V)

1. YouTube upload (Public) + URL paste.
2. Devpost submit (before Nov 12, 21:00 Paris).
3. AG Studio trial key + written consent (before Nov 11 EOD, else fallback).
4. ≥1 usability session (protocol ready, zero run).
5. Vultr upkeep through Dec 15.

## Inconsistencies found and fixed this mission

- README/JURY said 281 passed; DEVPOST/CHECKLIST said 288; manifest said
  288/10 while code was at 288/10 → re-ran at HEAD, canonical is now
  314/33 + 12/12 everywhere (governed docs).
- DEVPOST "No live-money code paths exist" vs README gated config →
  corrected to gated wording; drift-banned the absolute form.
- Provider-initiated partial refunds recorded the FULL capture amount
  (found by inspection, reproduced RED, fixed to the exact webhook
  amount with a regression test in `paypal.chaos.test.ts`).
- Studio e2e flaked locally on the 5 s pill default (CDN-first bundle
  load ~4 s on a slow link); raised to 30 s, assertion unchanged.
- JURY cited 1 PayPal loop (now 2), video rows all NOT DONE (now built),
  stale CI pin (now points at manifest `verifiedCiRun`).
- Gallery KPI hardcoded "(3 runs)" vs 4 recorded runs → computed from data.
- Manifest `verifiedCommit a504c23` trailed code by 2+ commits with no
  mechanical tripwire → drift gate now enforces lineage (verifiedCommit
  must be HEAD or docs-only behind it).
- `frontend.contract.test.ts` failed in keyed shells (asserted unkeyed
  status without clearing the key) → hermetic env; same hardening for
  `demo.sessions.test.ts`.
- Custom Studio tools (`getIncidentExposure`…) named in planning docs do
  not exist and were never claimed in governed docs — TITAN VI now ships
  real ones under verified names (`get_incident_exposure`, …).

## Workstream status

- A evidence truth: implementation done, manifest regen after branch CI.
- B judge mode: DONE (Hold scenario + 4 cards + 5 e2e).
- C isolation: DONE as honest fallback (report §6 + drift tripwire).
- D AG Grid agent: DONE (custom agent + tools + tests + demo doc).
- E impact pack: TODO (facilitation pack + ROI + pilot docs).
- F safety/security: suite green; unopened-body inspections TODO.
- G presentation/competitive: TODO (refresh pass).
- H+I submission/ops: changelog TODO (this batch), freeze/ops docs TODO.
- J jury sim: TODO after implementation (second workflow).
- Merge/deploy: TODO after green branch CI + final verification.

## Next actions (priority order)

1. Commit drift gate + doc sync; push `titan-vi`; record green CI run.
2. Regen manifest at the code commit + CI run; final docs-only sync.
3. E impact pack, F inspections, G refresh, H+I ops docs.
4. Jury-sim workflow → scorecard + final report.
5. Merge to `main` (explicit, reported) + redeploy decision + verify.
