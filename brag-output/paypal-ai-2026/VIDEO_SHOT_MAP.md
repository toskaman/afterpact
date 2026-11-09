# AFTERPACT — Video Shot Map (2:45 submission film)

Film: `AFTERPACT_PAYPAL_AI_FINAL.mp4` — 165.1 s, 1920×1080, 30 fps, H264 + AAC.
V2 cut (2026-11-09): S2 + S7 rebuilt around the Judge 60-second tour and the
LICENSED Studio; VO lines L05/L20 rewritten (L21 shifted +1.7 s).
Narration: EN, Kokoro `af_heart`, 25 lines, 92.1 s total. Subtitles burned from
`AFTERPACT_PAYPAL_AI_FINAL.srt` (25 cues, placement = composition root timeline).

Legend — footage provenance:
- **APP** = Playwright capture of the real running application (bug-for-bug authentic,
  including page-load paints).
- **GFX** = motion-graphics card (no app behavior implied).
- On-screen honesty badges are part of the scenes: `DEMO TRANSPORT: SIMULATED`,
  `RECORDED SANDBOX EVIDENCE`, `RECORDED RUNS`, `SIMULATED · MOCK`.

| # | Time | Scene | Visual | Footage | VO |
|---|------|-------|--------|---------|----|
| 1 | 0:00–0:15 | s1-hook | Command Center hero push-in, AFTERPACT title | APP `f5-hero-hold` ×2 (chain-s1, 13.13 s + hold) | L01–L03: hook — payment OK, delivery wrong, "Who makes it right?" |
| 2 | 0:15–0:38 | s2-promise | Landing funnel → Judge tour: Play click → Recover/Hold/Refuse → 3/3 finale + proof links | APP `f8-landing` 6.3 s + `clip6-tour` 7.3 s + finale tail-hold (chain-s2-v2, 23 s) | L04–L06: one click runs the story, PayPal executes |
| 3 | 0:38–0:46 | s3-sandbox | Proof card: order 2ER…722V → capture 7R1…771B → refund 8DJ…303G | GFX (values = real recorded sandbox IDs, creds redacted) | L07: recorded sandbox runs prove the loop |
| 4 | 0:46–1:14 | s4-twin | Outcome Twin: PROMISED / OBSERVED / RECOVERED, divergence strip, `1 KIT · $129.99 MISSING` | APP `f3-twin-long` 16.96 s + `clip2` 9.67 s (chain-s4) | L08–L11: short delivery, Twin lays it bare, $129.99 unaccounted |
| 5 | 1:14–1:42 | s5-resolution | AI proposal → policy check → human approve dialog → refund verified | APP `clip4` 4 s + `f6-recovery-gate` 12 s + `clip3` 11.4 s (chain-s5) | L12–L15: AI proposes, policy checks, human approves, PayPal confirms |
| 6 | 1:42–2:00 | s6-recorder | Flight Recorder chain-valid timeline, receipt | APP `f1-recorder-proof` 15.6 s + hold | L16–L18: hash-chained record, the artifact merchants keep |
| 7 | 2:00–2:20 | s7-intelligence | AI Evidence Gallery `117/120` + LICENSED Studio canvas + AI risk analyst | APP gallery 6.6 s + `f7-studio` 9.4 s (chain-s7-v2, 16 s) + hold | L19–L21: recorded runs, licensed studio + risk analyst, labeled |
| 8 | 2:20–2:35 | s8-safety | Injection refusal: `merchant-unknown → amount-increased → BLOCKED` | APP `f2-injection-refusal` 12.68 s + hold | L22–L23: malicious input, policy refuses, deterministically |
| 9 | 2:35–2:45 | s9-closing | Closing card: tagline + repo + demo URL | GFX | L24–L25: "AI can buy anything. AFTERPACT makes sure the outcome matches the promise." |

## Edit notes (auditable)

- Cuts at 15 / 38 / 46 / 74 / 102 / 120 / 140 / 155 s are hard scene boundaries
  (0.1 s crossfade overlap). Intra-scene footage joins (6.56 / 21.2 / 62.96 / 78 / 90 /
  126.6 s) are hard cuts inside continuous-zoom pushes — verified frame-clean
  (Hyperframes snapshots @ 21.3 / 26 / 36 / 128 / 138 s for v2 scenes).
- Source captures carry Playwright first-frame artifacts (grey flash, 1 frame in
  clip2/clip3, 7 frames in clip1, 2 frames in each v2 capture); these were removed
  at chain level with duration-preserving tail clones. No content frames were
  synthesized. V2 tail: S2 finale held ~9.5 s (readable proof links).
- Brief authentic app paints remain (e.g. Twin "Loading…" resolving ~1.5 s at 1:03):
  real application behavior, kept deliberately.
- Subtitle overlap: burned VO subs may touch the lower edge of scene pills
  (e.g. `1 KIT · $129.99 MISSING` at 1:03); both stay legible.
