# Video rushes — raw footage for the owner's <3min edit

Recorded 2026-11-08, local mock-transport build, Chromium 1920x1080 VP9
25fps. No audio, no narration, no secrets on screen (mock mode, AI·OFF).
The `.webm` files are LOCAL ONLY (gitignored); this README is committed.

| File | Duration | Content | Storyboard slot |
|---|---|---|---|
| clip1-flagship-run.webm | 11.2 s | Landing hero → Demo/Jury Mode → flagship run COMPLETED, acts | 0:15–1:05 (promise + payment) |
| clip2-outcome-twin.webm | 9.7 s | Outcome Twin 3-column scroll (promised/observed/recovered) | 1:05–1:35 (failure + recovery) |
| clip3-recovery-approve.webm | 11.4 s | Propose $129.99 → Approve & execute → confirm → approved | 1:05–1:35 (peak: human approval) |
| clip4-ai-gallery.webm | 11.6 s | AI Evidence Gallery scroll + recovery filter | 1:55–2:15 (intelligence) |
| clip5-studio.webm | 9.4 s | Commerce Intelligence Studio canvas + AI Assistant | 1:55–2:15 (intelligence) |

Total: ~53 s of selects. Missing (owner records or narrates over stills):
problem hook (0:00–0:15), PayPal Sandbox proof (recorded footage exists —
see RECORDING_PACKAGE), Flight Recorder close-up, refusal demo
(injection scenario), closing card. Full shot plan:
`docs/demo/RECORDING_PACKAGE.md`.

Regenerate: `tests/e2e/zz-clips.e2e.ts` (deleted after capture; recipe in
git history `120f4f5` era) + `npx playwright test zz-clips`.
