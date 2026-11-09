# AFTERPACT — Video QA Report

Date: 2026-11-09 (V3 cut; v2 archived in git history + `*_V1.srt`). Subject:
`AFTERPACT_PAYPAL_AI_FINAL.mp4` (+ `_CLEAN` pre-burn master).
Method: ffprobe + FFmpeg filters (blackdetect, freezedetect, loudnorm,
silencedetect), `hyperframes check` (0 errors / 0 warnings), Hyperframes
snapshot at 6 v3 instants (5 / 30 / 62 / 90 / 105 / 133 s), direct frame
inspection, v1 freeze-parity comparison.

## Format gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Runtime | < 180 s | 137.1 s | PASS |
| Resolution | 1920×1080 | 1920×1080 | PASS |
| Frame rate | 30 fps | 30/1 (CFR) | PASS |
| Video codec | H264 | H264 (CRF 18) | PASS |
| Audio codec | AAC | AAC 192 kbps, 48 kHz | PASS |
| Faststart (moov front) | yes | moov before mdat (probed) | PASS |
| File size | — | 52.2 MB FINAL / 82.9 MB CLEAN | info |

## Picture gates

| Gate | Method | Result | Verdict |
|---|---|---|---|
| No black frames | blackdetect d=0.5 | none | PASS |
| No unintended freezes | freezedetect n=0.003:d=2 vs v1 parity | 114–116 s (S7 static Studio tail + transition), 133.2–135.2 s (S9 static end card) = intended holds, same pattern as v1/v2 | PASS |
| Join integrity | Hyperframes snapshot @ 5 / 30 / 62 / 90 / 105 / 133 s (v3) | all scenes render full UI; retimed cuts land on content, no mid-transition frames | PASS |
| No silent gaps | silencedetect −50 dB d=2 | none ≥ 2 s (music bed carries the tail fade by design) | PASS |
| No secrets on screen | frame review of IDs/URLs | only public artifacts: sandbox order/capture/refund IDs (redacted creds labeled), repo URL, public demo URL | PASS |
| Honest labeling | frame review | SIMULATED / RECORDED SANDBOX EVIDENCE / RECORDED RUNS badges visible in every applicable scene; no mock-as-live | PASS |

## Audio gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Integrated loudness | ≈ −14 LUFS | −14.16 LUFS | PASS |
| True peak | ≤ −1 dBTP | −1.23 dBTP | PASS |
| LRA | — | 7.7 LU | info |
| Narration completeness | 25/25 lines | 25 cues, 1.2 s → 135.2 s, no gaps caused by errors | PASS |
| Subtitle sync | burned = VO | spot-checked @ 5.5 / 62 / 105 s: text matches audible line + on-screen action, scale-correct burn | PASS |

Note: 2-pass linear loudnorm (measured I −19.51 / TP −1.02 / LRA 7.30,
target_offset +0.36, TP target −1.5 to hold ≤ −1 dBTP after AAC). A first v3
pass used a naive offset (+5.51) and over-compressed the mix; redone with the
measured target_offset and re-verified. Music bed carries a voiceover spectral
carve (hyperframes-audio) so narration stays legible over the bed.

## Pipeline provenance

1. V2 assets reused unchanged (chains, Kokoro VO wavs, captures).
2. Composition retempo (all 9 scenes + VO/SFX/root retime, `music-bed-v3.wav`
   137 s faded bed, VO group + spectral carve) → `hyperframes check` 0/0 →
   `render --quality delivery` (2:17.0, screenshot capture).
3. `gen-srt.py` → `.srt` (25 cues) + `NARRATION_EN.txt`; loudnorm
   2-pass linear + libass burn (Arial 32, PlayRes 1080p, MarginV 60,
   CRF 18) + `+faststart` → `AFTERPACT_PAYPAL_AI_FINAL.mp4`.

## Known cosmetic notes (accepted)

- Subtitle descenders may touch the top edge of bottom-anchored scene pills
  (e.g. 0:47 `1 KIT · $129.99 MISSING`); both remain legible.
- Authentic app paints visible briefly after two footage cuts (Twin loading at
  0:47, resolves ≤ 1.5 s); real behavior, not a defect.

Verdict: **SUBMISSION-READY** — all hard gates pass.
