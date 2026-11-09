# Brag plan V2: AFTERPACT — jury film rebuild (OMEGA V)

Base: v1 (`brag-plan.md`, FINAL.mp4 165.1 s QA-passed). V2 keeps the
9-scene / 165 s skeleton, tone, music, SFX, and 23 of 25 VO lines.
Delta: the Judge 60-second tour (shipped after v1) becomes the hero
thread, the Studio shows its LICENSED state + AI risk analyst, and
the VO frames laborious→effortless honestly (no invented statistics).

## Changed scenes

- S2 promise (15–38): NEW chain — landing funnel → Judge page → Play
  click → stepper Recover→Hold→Refuse → finale with proof links.
  Footage: `f8-landing` + `clip6-tour` (both new, local build, mock
  transport, SIMULATED pills visible). Kickers: "01 · ONE CLICK" /
  "02 · THREE REAL OUTCOMES". Lower-third kept.
- S7 intelligence (120–140): chain = reused gallery segment +
  NEW `f7-studio` (LICENSED pill + Outcome Risk Analyst tools).
  Stats card kept (117/120, model, RECORDED RUNS).

## VO changes (Kokoro af_heart, same voice/speed)

- L04 keep. L06–L19, L21–L25 keep (wavs + placement untouched).
- L05' NEW: "No setup. No script to follow. One click runs the whole
  story — a delivery gone wrong, recovered, held, and refused —
  every step proven."
- L20' NEW: "Recorded model runs — every citation checked — and a
  licensed analytics studio, with its own AI risk analyst, over the
  same data."

## Before/after frame (honest, no fake stats)

Before = implied status quo (manual chasing across tools — never
quantified on screen; the narration claims only what the tour does:
one click, three real outcomes, proof links). After = the tour
footage itself. No before-montage fabricated.

## Grounding (same bar as v1)

New footage = Playwright captures of the real local build (bug-for-bug
authentic). AG key via local env from APIS.txt, never echoed, never
committed, never on screen. Mock pills stay visible. IDs/amounts/model
names quote repo artifacts only.

## Pipeline (same as v1 QA report)

capture-v2.mjs → chains via ffmpeg → hyperframes compose edit →
`hyperframes check` zero-error → snapshot review → render →
loudnorm → gen-srt.py → libass burn + faststart → QA gates →
promote to FINAL (v1 archived as …_V1).
