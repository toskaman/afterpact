# TITAN V — Evidence Ledger (claims → proof)

Conventions: PASS = verified this mission or carries a live artifact reference.
Labels: `UNVERIFIED` / `HYPOTHESIS` / `ESTIMATE` / `NOT MEASURED` where applicable.

| # | Public-facing claim | Proof | Status |
|---|---|---|---|
| 1 | Demo video <3 min exists, shows real app | `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_FINAL.mp4` (165.1 s) + `VIDEO_QA_REPORT.md` | PASS |
| 2 | Sandbox loop order→capture→refund verified | `docs/demo/paypal-live-receipts.json`: `2ER387580K033722V` / `7R158417X9367771B` / `8DJ895035B173303G` | PASS |
| 3 | Film refund ID correct | s3 scene source + receipts + inspected frame @43 s | PASS |
| 4 | Live demo reachable, chain valid | `https://199.247.9.188.nip.io/api/health` (ok, build `d1e79f2`, auditChainValid) | PASS |
| 5 | CI green on HEAD | run `42490075428` success | PASS |
| 6 | Simulated vs recorded vs live labeled | On-screen pills in film + app (`MOCK · SIMULATED`, `RECORDED …`, `AI · OFF`) | PASS |
| 7 | AI evals 117/120, latest 30/30 | 4× `docs/evals/report-*.json` re-read 2026-11-08: 28+29+30+30 passes, model `deepseek-v4.1-flash-1017`, citP 1.0 each run; corpus 30 live + 23 offline in `tests/eval/scenarios.ts` | PASS |
| 8 | AI vs heuristic 59/60 vs 9/15 | `docs/evals/BASELINE_COMPARISON.md` re-read 2026-11-08 (AI = 15 intent scenarios × 4 runs) | PASS |
| 9 | Human time saved / usability | n=1 internal walkthrough only; 637 ms = machine time; 28 min = ESTIMATE | NOT MEASURED |
| 10 | AG Studio authorized for judging | Trial key not installed, consent drafted-not-sent | UNVERIFIED → cutoff Nov 11 EOD, else Community-only fallback |
| 11 | Devpost submitted / video public | Draft ready; upload + submit = owner steps | NOT DONE (owner) |
| 12 | Session isolation complete | Per-run tokens only; full isolation NOT implemented (manifest limitation) | PARTIAL (documented) |
| 13 | Deadline/criteria/rules | 3+ secondary sources agree; direct Devpost fetch 403 | PASS (secondary) — owner confirms on form |

## Ledger maintenance

Append rows for every new public claim before it ships in README/Devpost/video.
Phase 1 must re-verify rows 7–8 artifact paths and row 10's compliance decision.
