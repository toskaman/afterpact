# TITAN VI — State (trust & outcome assurance)

Date: 2026-11-09 (Europe/Paris). Supersedes `TITAN_V_STATE.md` as the live
position file; TITAN V documents stay frozen as history.

## Position

- Branch: `titan-vi` (from `main` @ `5e78098`).
- Final code SHA: `56a541c`. Manifest commit: this sync (docs-only).
- Working tree at sync: manifest + scorecard + final report + this file;
  nothing else. (`.npm-cache/` untracked, pre-existing, untouched.)
- Latest CI on `main`: run #59 (`42547352382`, verify+e2e+drift green).
- Branch CI: run
  [#42619291765](https://github.com/toskaman/afterpact/actions/runs/42619291765)
  on `56a541c`: verify ✓ (317/33), e2e ✓ (12/12), drift ✗ only for
  manifest staleness (resolved by this regen; final CI expected all-green).
- Deployment: `f605790` live on `https://199.247.9.188.nip.io`
  (mock-simulated, keyless; verified 2026-11-09: health ok, chain valid,
  flagship + hold smokes completed, risk-analyst markers served).
  Pre-deploy backup `/root/afterpact-backup-20261109-f6057900.tgz`
  (sha256 `6c3f2865…aa63f`); operator token rotated into gitignored
  `APIS.txt` and hash-verified against the live unit.
- Submission: NOT submitted. Video file built, YouTube upload owner-side.
  Devpost draft current, submit owner-side.

## Observed test results (2026-11-09, keyless, branch `titan-vi`)

- `npm run typecheck`: exit 0 (6 projects).
- `npm test`: **317 passed, 0 failed, 33 skipped** (350 total, 39 files).
  Baseline was 288/0/33; +29 from TITAN VI (hold 2, concurrency 1,
  risk-tools 7, drift 15, studio contract 1, webhook-amount regression 1,
  metrics-summary 1, receipts loop-2 pin 1).
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
- Jury-sim fixes (all verified): Studio tab markup `>`; `.judge-lifecycle`
  styling + scroll-margin; route() focus to #main; CTA link→button;
  metrics table generated from reports (latencies corrected on 4 rows);
  baseline heuristic scored as shipped (9/15→12/15, artifacts regen);
  eval README counts (22/16/11/4) + F1 narrative + suite-version caveat;
  receipts loop-2 pinned; dead `offer-evaluation` task id removed;
  Studio tool-kind comment corrected + pinned in tests.
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

## Workstream status (all agent work DONE)

- A evidence truth: DONE (drift v2 + regen manifest @ code SHA + CI run).
- B judge mode: DONE (Hold scenario + 4 cards + 5 e2e).
- C isolation: DONE as honest fallback (report §6 + drift tripwire).
- D AG Grid agent: DONE (custom agent + tools + tests + demo doc).
- E impact pack: DONE (facilitation + ROI + pilot; sessions owner-side).
- F safety/security: DONE (webhook-amount fix + inspections + scans).
- G presentation/competitive: DONE (OmegaCommerce + screenshot + pass).
- H+I submission/ops: DONE (changelog + runbook + freeze inputs).
- J jury sim: DONE (30/50 as-simulated; agent fixes applied + verified).
- Merge/deploy: THIS STEP (explicit merge + redeploy + verify).

## Next actions (priority order)

1. Push manifest sync → confirm final CI all-green.
2. Merge `titan-vi` → `main` (explicit, reported) + redeploy + verify.
3. Owner: YouTube + submit + consent + usability + upkeep (§7 report).
