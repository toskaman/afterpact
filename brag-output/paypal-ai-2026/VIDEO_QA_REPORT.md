# AFTERPACT — Video QA Report

Date: 2026-11-08. Subject: `AFTERPACT_PAYPAL_AI_FINAL.mp4` (+ `_CLEAN` pre-burn master).
Method: ffprobe + FFmpeg filters (blackdetect, freezedetect, loudnorm, framemd5),
Hyperframes snapshot at 7 join/transition instants, direct frame inspection.

## Format gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Runtime | < 180 s | 165.1 s | PASS |
| Resolution | 1920×1080 | 1920×1080 | PASS |
| Frame rate | 30 fps | 30/1 (CFR) | PASS |
| Video codec | H264 | H264 (CRF 17) | PASS |
| Audio codec | AAC | AAC 192 kbps, 48 kHz | PASS |
| Faststart (moov front) | yes | ftyp,moov,free,mdat | PASS |
| File size | — | 54.4 MB FINAL / 86.4 MB CLEAN | info |

## Picture gates

| Gate | Method | Result | Verdict |
|---|---|---|---|
| No black frames | blackdetect d=0.5 | none | PASS |
| No unintended freezes | freezedetect d=0.5, 27 spans reviewed | all spans = intentional holds (scene-end holds, s3 proof card 40–46 s, s9 end card, 1.2 s static approve dialog at 95.6–96.8 s); frames visually confirmed | PASS |
| Join integrity (6 intra-scene cuts) | Hyperframes snapshot @ 6.56 / 15.1 / 26.2 / 62.96 / 78 / 90 / 126.6 s + per-frame size scan | all joins render full UI; source flash frames (clip1 ×7, clip2/clip3 ×1) removed, durations preserved to the frame | PASS |
| No secrets on screen | frame review of IDs/URLs | only public artifacts: sandbox order/capture/refund IDs (redacted creds labeled), repo URL, public demo URL | PASS |
| Honest labeling | frame review | SIMULATED / RECORDED SANDBOX EVIDENCE / RECORDED RUNS badges visible in every applicable scene; no mock-as-live | PASS |

## Audio gates

| Gate | Target | Measured | Verdict |
|---|---|---|---|
| Integrated loudness | ≈ −14 LUFS | −15.39 LUFS | PASS (note) |
| True peak | ≤ −1 dBTP | −1.13 dBTP | PASS |
| LRA | — | 8.4 LU | info |
| Narration completeness | 25/25 lines | 25 cues, 1.2 s → 161.2 s, no gaps caused by errors | PASS |
| Subtitle sync | burned = VO | spot-checked @ 2.5 / 60 / 63 / 64.5 / 150 s: text matches audible line | PASS |

Note: integrated loudness lands 1.4 dB under −14 because the mix's peak-to-loudness
ratio forces the trade-off once the hard −1 dBTP ceiling (incl. AAC overshoot
headroom) is enforced. Platforms normalize this inaudibly; no audible pumping
was introduced (dynamic loudnorm, single stage).

## Pipeline provenance

1. `hyperframes render --video-frame-format png` → `AFTERPACT_DRAFT.mp4` (165.0 s).
2. `loudnorm I=-14:TP=-1.5:LRA=11` (dynamic, 1 stage), video copy →
   `AFTERPACT_PAYPAL_AI_CLEAN.mp4` (86.4 MB, no subs).
3. `gen-srt.py` (VO placement from composition root timeline + `vo-lines.json`) →
   `AFTERPACT_PAYPAL_AI_FINAL.srt` (25 cues) + `NARRATION_EN.txt`.
4. libass burn (Arial 22, outline, MarginV 40), CRF 17, audio copy →
   `AFTERPACT_PAYPAL_AI_FINAL.mp4`; `+faststart` on both MP4s.

## Known cosmetic notes (accepted)

- Subtitle descenders may touch the top edge of bottom-anchored scene pills
  (e.g. 1:03 `1 KIT · $129.99 MISSING`); both remain legible.
- Authentic app paints visible briefly after two footage cuts (Twin loading at
  1:03, resolves ≤ 1.5 s); real behavior, not a defect.
- s1→s2 boundary frame (15.1 s) is a mid-crossfade dark frame; normal transition.

Verdict: **SUBMISSION-READY** — all hard gates pass.
