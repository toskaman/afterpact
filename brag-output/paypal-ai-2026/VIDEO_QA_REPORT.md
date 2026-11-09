# AFTERPACT — Video QA Report

Date: 2026-11-09 (V2 cut; v1 archived in git history + `*_V1.srt`). Subject:
`AFTERPACT_PAYPAL_AI_FINAL.mp4` (+ `_CLEAN` pre-burn master).
Method: ffprobe + FFmpeg filters (blackdetect, freezedetect, loudnorm,
silencedetect), `hyperframes check` (0 errors / 0 warnings), Hyperframes
snapshot at 5 v2 instants (21.3 / 26 / 36 / 128 / 138 s), direct frame
inspection, v1 freeze-parity comparison.

## Format gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Runtime | < 180 s | 165.1 s | PASS |
| Resolution | 1920×1080 | 1920×1080 | PASS |
| Frame rate | 30 fps | 30/1 (CFR) | PASS |
| Video codec | H264 | H264 (CRF 18) | PASS |
| Audio codec | AAC | AAC 192 kbps, 48 kHz | PASS |
| Faststart (moov front) | yes | moov before mdat (probed) | PASS |
| File size | — | 55.2 MB FINAL / 87.1 MB CLEAN | info |

## Picture gates

| Gate | Method | Result | Verdict |
|---|---|---|---|
| No black frames | blackdetect d=0.5 | none | PASS |
| No unintended freezes | freezedetect n=0.003:d=2 vs v1 parity | identical flags as v1 (S1 slow-push 4.3 / 9.13 s, static cards) = intended look, not defects | PASS |
| Join integrity (6 intra-scene cuts) | Hyperframes snapshot @ 21.3 / 26 / 36 / 128 / 138 s (v2) + v1 joins unchanged | all joins render full UI; source flash frames (clip1 ×7, clip2/clip3 ×1, v2 captures ×2) removed, durations preserved | PASS |
| No silent gaps | silencedetect −50 dB d=2 | single 2.7 s tail fade 162.4–165.1 s (music bed, by design); no mid-film gaps | PASS |
| No secrets on screen | frame review of IDs/URLs | only public artifacts: sandbox order/capture/refund IDs (redacted creds labeled), repo URL, public demo URL | PASS |
| Honest labeling | frame review | SIMULATED / RECORDED SANDBOX EVIDENCE / RECORDED RUNS badges visible in every applicable scene; no mock-as-live | PASS |

## Audio gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Integrated loudness | ≈ −14 LUFS | −14.40 LUFS | PASS |
| True peak | ≤ −1 dBTP | −1.25 dBTP | PASS |
| LRA | — | 7.9 LU | info |
| Narration completeness | 25/25 lines | 25 cues, 1.2 s → 161.2 s, no gaps caused by errors | PASS |
| Subtitle sync | burned = VO | spot-checked @ 5.5 / 22 / 126 s: text matches audible line, scale-correct burn | PASS |

Note: 2-pass linear loudnorm (measured I −20.51 / TP −0.99 / LRA 13.20,
offset +1.29). First v2 burn used wrong PlayRes (subs 4× too large);
re-burned with PlayResX/Y 1920×1080 + FontSize 32 and re-verified.

## Pipeline provenance

1. `capture-v2.mjs` (Playwright 1920×1080, dark, keyless AI, local AG key) →
   `f8-landing` / `clip6-tour` / `f7-studio` (frames reviewed).
2. ffmpeg chains (`chain-s2-v2` 23.0 s, `chain-s7-v2` 16.0 s, CFR 30,
   flash frames dropped, tail clones) + `hyperframes tts` (Kokoro
   af_heart) for rewritten L05/L20.
3. Composition edit (S2/S7 scenes + VO placement, L21 +1.7 s) →
   `hyperframes check` 0/0 → `render --quality delivery` →
   `AFTERPACT_PAYPAL_AI_CLEAN.mp4` (87.1 MB, no subs, 165.0 s).
4. `gen-srt.py` → `.srt` (25 cues) + `NARRATION_EN.txt`; loudnorm
   2-pass linear + libass burn (Arial 32, PlayRes 1080p, MarginV 60,
   CRF 18) + `+faststart` → `AFTERPACT_PAYPAL_AI_FINAL.mp4`.

## Known cosmetic notes (accepted)

- Subtitle descenders may touch the top edge of bottom-anchored scene pills
  (e.g. 1:03 `1 KIT · $129.99 MISSING`); both remain legible.
- Authentic app paints visible briefly after two footage cuts (Twin loading at
  1:03, resolves ≤ 1.5 s); real behavior, not a defect.
- s1→s2 boundary frame (15.1 s) is a mid-crossfade dark frame; normal transition.

Verdict: **SUBMISSION-READY** — all hard gates pass.
