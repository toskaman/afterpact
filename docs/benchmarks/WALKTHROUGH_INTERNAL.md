# Internal engineering walkthrough — incident triage (NOT independent validation)

Status: INTERNAL, n=1, operator = the implementing engineer.
Independent user validation: NOT VERIFIED (no outside participants; protocol in USABILITY_STUDY.md ready).

## Method

Real UI (Chromium, Playwright) against a local mock-transport build, commit `9b2d52b`.
Six operator tasks from TITAN III §7.1, timed end-to-end in the browser.
Setup steps (flagship run, incident seeding, reading the promise total) are labeled
and excluded from operator-task times.

These are MACHINE interaction times on localhost — a lower bound on system
responsiveness, NOT human task-completion times. Human reading, judgment, and
hesitation are unmeasured. No manual-baseline timing exists; the manual comparison
stays structural (touchpoints), never presented as measured savings.

## Results (2026-11-08)

| # | Task (start → success) | Time | Observed |
|---|---|---:|---|
| setup | Run flagship scenario via UI (machine) | 130 ms | COMPLETED, 9 acts |
| T1 | Identify the discrepancy (twin divergence strip) | 48 ms | "Short delivery: promised 3, 2 delivered (1 missing)" |
| T2 | Amount at risk on the OPEN incident | 28 ms | Outstanding exposure $389.97 (full capture, unverified — not the missing share) |
| T3 | Find supporting evidence (transaction view) | 22 ms | delivery-scan outcome visible |
| T4 | Decide whether a refund is permitted (live policy verdict) | 10 ms | POLICY badge + divergence strip read |
| T5 | Propose ($129.99 = one third) + approve & execute with confirm dialog | 317 ms | approved, provider-verified |
| T6 | Export dispute-ready record (filtered, redacted) | 212 ms | 11 entries, chainValid true, no secret patterns |

Total measured operator-task time: 637 ms (machine time; excludes human judgment).

## Errors and friction observed

- None in this run: 6/6 tasks succeeded first try, zero console errors.
- Known UI friction (unmeasured): the propose form hides inside a collapsed
  `<details>`; the operator must size the partial amount by hand (no calculator).

## What this does NOT prove

- No claim about first-time-user comprehension or speed.
- No claim about human time saved vs a manual PayPal-dashboard workflow.
- No external participants, no blinding, no confidence intervals (n=1).
