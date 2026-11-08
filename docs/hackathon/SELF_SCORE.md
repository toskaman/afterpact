# AFTERPACT internal jury self-score (2026-11-08, TITAN III)

Internal scoring against the five official criteria. Scores are evidence-based
and deliberately strict; they are NOT official results. See
`docs/audit/100_QUESTIONS.md` (142 questions: 114 PASS / 21 PARTIAL /
5 FAIL / 2 UNKNOWN after the TITAN III appendix) for the underlying audit.
Full rationale: `docs/hackathon/TITAN_III_FINAL_REPORT.md` §D.

| Criterion | Score | Evidence | Deductions |
|---|---:|---|---|
| Technological Implementation | 9/10 | Chaos 9/9, continue-gate + cap, persistence .bak + shape tests, AI 117/120 + baseline 59/60 vs 9/15, Studio kill-switch, 288+33 + 7/7 e2e + Newman 37/37+18/18, CI green, box @ HEAD | −1 single-node JSON by decision (no crash-recovery proof) + global lists still shared (no full tenant isolation) |
| Design | 9/10 | Landing hero CTA, AI-off gallery pointers, copy-truth fixes, keyboard verified (skip-link → main), 0 console warnings, twin/gallery/studio footage-checked | −1 no independent usability session (package ready, Q84/Q127 FAIL) |
| Potential Impact | 8/10 | Timed internal walkthrough 637 ms machine (n=1, NOT users) + enterprise buyer case with labeled assumptions; structural 8→3 win | −2 no interviews/users, no measured human timings (Q126/Q127 FAIL) |
| Innovation | 9/10 | 13-stage lifecycle vs 15+ entries; 120-scenario committed eval corpus; quantified AI lift over heuristic (59/60 vs 9/15); captured-payment tail owned | −1 no durable moat proof yet (pilots + data pending) |
| Presentation | 7/10 | Demo live @ HEAD build; Devpost current; 5 raw 1080p rushes local for owner edit; gallery + docs coherent | −3 VIDEO FILE MISSING (owner step, Q6/Q134 FAIL) |

Total: **42/50** (unchanged since OMEGA II — and that is the honest story:
T3 closed every engineer-actionable gap and converted the work into
committed evidence, but all 8 missing points require the owner: video
edit, outside users, AG Grid reply, pilots).

## What flips the score before submission

1. Owner edits + publishes the <3-min video (rushes in `video-rushes/`) →
   Presentation 7 → 9/10.
2. One usability session with an outsider (30 min, `USABILITY_STUDY.md`) →
   Design +1, Impact +1, clears Q84/Q126/Q127.
3. Trial licence key installed + redeploy (watermark gone) → clears
   Q112/Q117, strengthens the sponsor slice.
4. Consent request sent to AG Grid → clears Q10/Q116 residual.
   Cutoff Nov 11 EOD, else ship Community-only (`AG_STUDIO_DISABLED=1`).
