# AFTERPACT — Remediation Tracker

Source: `docs/audit/100_QUESTIONS.md` (2026-11-07). Only PARTIAL/FAIL/
UNKNOWN items are tracked. Owner: whoever clears the item (human = repo
owner, agent = build agent). Re-verify by re-running the stated command.

## FAIL (must clear before submission)

| Q | Gap | Fix | Owner | Verify |
|---|---|---|---|---|
| Q5 | ~~No hosted demo URL~~ CLOSED 2026-11-07 | Vultr VPS live at `https://199.247.9.188.nip.io` (Caddy + production LE cert); health ok + remote flagship `completed` verified; URL pasted in README + Devpost draft | agent | `VULTR_HOSTING.md`; live checks green |
| Q6 | No <3-min video | Record from `docs/demo/DEMO_SCRIPT.md` shot list; upload unlisted/public to YouTube | human | URL plays <3:00; shows real-vs-simulated badges |
| Q84 | No third-party usability test | One 30-min session with a non-builder: run flagship + injection, note friction | human | Notes file + fixed issues linked |
| Q88 | ~~No screenshots/diagram~~ CLOSED 2026-11-07 | Captured 9 shots (command, demo, copilot, tx, recovery, recorder, studio, timeline, discovery) + `docs/architecture/ARCHITECTURE.md`; 0 console errors | agent | `docs/demo/screenshots/` (9 PNG) + diagram verified in repo |

## PARTIAL (clear in priority order)

| Q | Gap | Fix | Owner | Verify |
|---|---|---|---|---|
| Q1/Q12/Q36/Q42 | ~~Live PayPal partially executed~~ CLOSED 2026-11-07 | Full live loop completed: order 2ER387580K033722V → capture 7R158417X9367771B → refund 8DJ895035B173303G (`succeeded`, 12999 USD) → Recorder VALID. Also fixed: amountless POST-refund responses (wire schema + fallback + 2 regression tests) | agent | Gate 15 PASS; IDs verified at provider |
| Q18 | AG Studio not integrated | Only if Studio access obtained: embed per `AG_STUDIO_UPGRADE_PATH.md`; else keep honest Community claim | human | Studio dashboard on live data or unchanged non-claim |
| Q19 | No live Channel3 call | Set `CHANNEL3_API_KEY`, re-run Act 2 / `#/discovery` | human | `CHANNEL3 · LIVE` badge + logged request in Recorder |
| Q20/Q69 | Render/CI unverified | Push to GitHub (public), watch CI green, apply Blueprint | human | CI badge green; live URL |
| Q70 | Postman never executed in Postman | Import + run collection (or Newman) against local + hosted | human/agent | Runner output, 0 failures |
| Q2 | No LLM anywhere | Optional: add one strict-output LLM call (intent extraction) behind `AI_PROVIDER_KEY`; keep deterministic fallback | agent | Eval: valid-output rate on fixtures; fallback test still green |
| Q3/Q7 | Repo not public | Create public GitHub repo, push `main`, confirm MIT + availability note | human | Public URL + license visible |
| Q11 | One-click hosted trial | Same as Q5 | human | Same as Q5 |
| Q23/Q24 | Impact hypotheses unvalidated | 5 ops interviews + 1 shadowed queue; record in `IMPACT_BENCHMARK.md` | human | Dated notes, no invented numbers |
| Q59 | No distributed approval lock | Document single-node scope; add DB-backed lock only if multi-instance deploy is planned | agent | Concurrency test vs real DB |
| Q76 | No browser E2E | Add Playwright smoke (flagship click-through) if time allows | agent | `playwright test` green in CI |
| Q77/Q78 | No load/chaos suite | Optional pre-submit: k6 smoke + kill-switch drill | agent | Numbers in benchmark doc |
| Q97 | Single-node scaling | Out of scope for hackathon; note in README (already disclosed) | — | — |

## UNKNOWN

| Q | Gap | Disposition |
|---|---|---|
| Q57 | Multi-tenancy untested | Accepted: single-tenant build, no isolation claims made anywhere. Revisit only if a multi-merchant pilot starts. |

## Closed during this build (for the record)

Replay-before-gate idempotency (2 bugs), NL attached-op parse, lockfile
EUSAGE, dist static path, mislabeled sponsor rows — see `RELEASE_GATE.md`
"bugs found and fixed". 155/156 tests green at baseline.
