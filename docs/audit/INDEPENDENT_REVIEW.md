# AFTERPACT — Independent Review (simulated jury, 2026-11-07)

Five reviewers + four sponsor lenses, each scoring 0–10 against the
evidence actually in the repo at `2a26d05`. No reviewer saw the builders'
claims — only files, tests, and docs. Scores are internal and conservative.

## R1 — Technological Implementation: 7/10

Evidence reviewed: `packages/*`, `apps/api`, 155 green tests, `tsc` clean,
release gate, CI config.
Strengths: real state machines, exact money, replay-before-gate
idempotency, webhook verification, hash-chained audit, reproducible
flagship. Objections: PayPal proven on mock only; persistence is a JSON
snapshot; no browser E2E. Missing proof: one live-sandbox capture+refund
with provider IDs. Fix cost: low (creds + one recorded run).

## R2 — Design: 7/10

Evidence reviewed: `apps/web/public/*`, demo guide, labeling policy.
Strengths: 9 coherent views, dark/light, responsive, WCAG measures,
origin badges everywhere, empty/error/loading states. Objections: visual
polish unverified without screenshots; no third-party usability pass.
Missing proof: screenshots + one usability session. Fix cost: low.

## R3 — Potential Impact: 5/10

Evidence reviewed: commercial strategy, unit economics, benchmark doc,
competitive landscape. Strengths: crisp persona, honest hypotheses,
machine-measured baseline, invalidation conditions stated. Objections:
zero external validation — no interviews, no pilot, no users. Missing
proof: 5 interviews + 1 shadowed queue. Fix cost: medium (human time).

## R4 — Innovation: 8/10

Evidence reviewed: promise engine, lifecycle, Flight Recorder, flagship,
landscape doc. Strengths: genuine post-payment category (promise →
verification → authorized recovery → verified result), hash-chained
promises with approval binding, injection-resistant policy gates. No
named competitor covers Acts 5–8. Objections: recovery verified on mock
money. Missing proof: live-sandbox verified refund. Fix cost: low.

## R5 — Presentation: 4/10

Evidence reviewed: README, demo script, Devpost draft, guides.
Strengths: excellent written materials, reproducible one-command demo,
honest labeling story. Objections: no video, no hosted URL, no
screenshots — the three artifacts judges actually consume first. Missing
proof: <3-min video + live URL. Fix cost: medium (human recording + deploy).

## Sponsor lenses

- **AG Grid: 6/10.** Real Community integration on live data + NL queries
  is solid; but the $5k first place realistically wants AG Studio, which
  is honestly not claimed. Path: pursue only with Studio access.
- **Channel3: 5/10.** Client + normalization + fail-closed are credible;
  zero live calls. Path: one keyed live search on camera converts this.
- **Postman: 8/10.** 38-request collection, validated, negatives included.
  Path: execute in Runner/Newman and attach output.
- **Render: 3/10.** Config-only. Path: apply Blueprint, paste URL.

## Verdict

Average 6.2/10 — a strong engineering entry that currently loses on
presentation and live proof, not on ideas. The three human steps (sandbox
creds run, Render deploy, <3-min video) are worth more than any further
code. Do not add features until gates 15–16 (`RELEASE_GATE.md`) are green.
