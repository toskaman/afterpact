# TITAN V — Internal jury scorecard (evidence-backed, NOT official)

Date: 2026-11-08. HEAD: `7748743`. Internal simulated scores only — no AI score
predicts independent judges. Deductions listed per criterion; fix list at bottom.

| Criterion | Score | Key evidence | Top deductions |
|---|---:|---|---|
| Technological Implementation | 8/10 | Sandbox loop `2ER…→7R1…→8DJ…` test-pinned; real Vultr inference w/ 53-scenario corpus (117/120, citP 1.0); deterministic gates + human approval; 288 vitest + 7 e2e + Newman 37/37 + CI green; honest origin badges | Single-node JSON store; no full per-session isolation (per-run tokens only); public demo runs mock transport |
| Design | 8/10 | Signature theme + dark/light; Outcome Twin promised/observed/recovered; Flight Recorder timeline; Studio + Community analytics; a11y pass (keyboard, focus, AA targets) | No dedicated 30-second Judge Mode entry yet (Phase 3); some dense ops views; mobile verified but desktop-first |
| Potential Impact | 6/10 | Sharp buyer hypothesis (Merchant Ops Manager) + honest ROI assumptions; structural wins test-proven (bounds, injection blocks, evidence bundles); pilot package drafted | **Zero independent users/pilots/revenue**; 637 ms = machine time, 28 min = estimate — both labeled, neither measured human savings |
| Innovation | 8/10 | Post-payment outcome-assurance thesis (promise→observed→recovery→verified result); 13-stage mapping vs 15+ entries in `WHY_AFTERPACT_IS_DIFFERENT.md`; AI-proposes/policy+human-dispose architecture | Thesis is compositional (combines known primitives); single-category depth over breadth |
| Presentation | 8/10 | 165 s film QA-passed (1080p30, subs, loudness, honest labels); Devpost draft fully written with verified numbers; live one-click demo; docs-truth manifest + drift gate | Film not yet public (owner upload); no usability narrative on camera |

**Internal total: 38/50.** Confidence: high on Tech/Presentation (artifacts in-repo),
medium on Design/Innovation (judge taste), low on Impact (missing humans).

## Highest-impact corrective actions (ranked)

1. Publish film + submit Devpost (owner) — unlocks Presentation fully.
2. Run ≥1 real usability session (owner) — biggest Impact lever; honest n=1 > nothing.
3. AG Grid consent-or-fallback by Nov 11 EOD — protects sponsor eligibility.
4. Judge Mode entry + session isolation (Phase 3, post-submit) — Design/Tech depth.
5. SQLite/per-session persistence only if zero-risk before judging — else document.
