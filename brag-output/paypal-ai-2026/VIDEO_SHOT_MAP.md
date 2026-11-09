# AFTERPACT — Video Shot Map (2:17 submission film)

Film: `AFTERPACT_PAYPAL_AI_FINAL.mp4` — 137.1 s, 1920×1080, 30 fps, H264 + AAC.
V3 cut (2026-11-09): retempo of V2 — same story, footage and VO, 28 s of
holds/tails removed so no shot waits; music bed rebuilt as a 137 s faded bed
(`music-bed-v3.wav`) with a voiceover spectral carve for narration clarity.
Narration: EN, Kokoro `af_heart`, 25 lines, 92.1 s total. Subtitles burned from
`AFTERPACT_PAYPAL_AI_FINAL.srt` (25 cues, 1.2 s → 135.2 s, placement = v3 root timeline).

Legend — footage provenance:
- **APP** = Playwright capture of the real running application (bug-for-bug authentic,
  including page-load paints).
- **GFX** = motion-graphics card (no app behavior implied).
- On-screen honesty badges are part of the scenes: `DEMO TRANSPORT: SIMULATED`,
  `RECORDED SANDBOX EVIDENCE`, `RECORDED RUNS`, `SIMULATED · MOCK`.

| # | Time | Scene | Visual | Footage | VO |
|---|------|-------|--------|---------|----|
| 1 | 0:00–0:10 | s1-hook | Command Center hero push-in, AFTERPACT title | APP `f5-hero-hold` (chain-s1, hold removed) | L01–L03: hook — payment OK, delivery wrong, "Who makes it right?" |
| 2 | 0:10–0:30 | s2-promise | Landing funnel → Judge tour: Play click → Recover/Hold/Refuse → 3/3 finale + proof links | APP `f8-landing` + `clip6-tour` + tighter finale tail (chain-s2-v2, 19.5 s window) | L04–L06: one click runs the story, PayPal executes |
| 3 | 0:30–0:35 | s3-sandbox | Proof card: order 2ER…722V → capture 7R1…771B → refund 8DJ…303G | GFX (values = real recorded sandbox IDs, creds redacted) | L07: recorded sandbox runs prove the loop |
| 4 | 0:35–0:57 | s4-twin | Outcome Twin: PROMISED / OBSERVED / RECOVERED, divergence strip, `1 KIT · $129.99 MISSING` | APP `f3-twin-long` + `clip2` (chain-s4, hold removed) | L08–L11: short delivery, Twin lays it bare, $129.99 unaccounted |
| 5 | 0:57–1:23 | s5-resolution | AI proposal → policy check → human approve dialog → refund verified | APP `clip4` + `f6-recovery-gate` + `clip3` (chain-s5) | L12–L15: AI proposes, policy checks, human approves, PayPal confirms |
| 6 | 1:23–1:38 | s6-recorder | Flight Recorder chain-valid timeline, receipt | APP `f1-recorder-proof` (hold removed) | L16–L18: hash-chained record, the artifact merchants keep |
| 7 | 1:38–1:56 | s7-intelligence | AI Evidence Gallery `117/120` + LICENSED Studio canvas + AI risk analyst | APP gallery + `f7-studio` (chain-s7-v2, 16 s) | L19–L21: recorded runs, licensed studio + risk analyst, labeled |
| 8 | 1:56–2:09 | s8-safety | Injection refusal: `merchant-unknown → amount-increased → BLOCKED` | APP `f2-injection-refusal` (hold removed) | L22–L23: malicious input, policy refuses, deterministically |
| 9 | 2:09–2:17 | s9-closing | Closing card: tagline + repo + demo URL | GFX | L24–L25: "AI can buy anything. AFTERPACT makes sure the outcome matches the promise." |

## Edit notes (auditable)

- Cuts at 10 / 29.5 / 35 / 57 / 83 / 98 / 116 / 129 s are hard scene boundaries
  (0.1 s crossfade overlap). Intra-scene footage joins are hard cuts inside
  continuous-zoom pushes — verified frame-clean (Hyperframes snapshots @ 5 / 30 /
  62 / 90 / 105 / 133 s for v3).
- Source captures carry Playwright first-frame artifacts (grey flash, 1 frame in
  clip2/clip3, 7 frames in clip1, 2 frames in each v2 capture); these were removed
  at chain level with duration-preserving tail clones. No content frames were
  synthesized. V3 shortens S2/S4/S5/S6/S7/S8 footage windows and removes all
  static end-holds; no shot lingers after its VO ends.
- Brief authentic app paints remain (e.g. Twin "Loading…" resolving ~1.5 s at 0:47):
  real application behavior, kept deliberately.
- Subtitle overlap: burned VO subs may touch the lower edge of scene pills
  (e.g. `1 KIT · $129.99 MISSING` at 0:47); both stay legible.
