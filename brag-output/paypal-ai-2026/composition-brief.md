# Hyperframes Composition Brief: AFTERPACT submission film

## Objective

Create the 2:45 PayPal AI Hackathon submission film for AFTERPACT —
cinematic + polished, voiceover-driven, real app footage central.

## Output

- Composition directory: `brag-output/paypal-ai-2026/composition/`
- Rendered video: `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_CLEAN.mp4` (subs burned separately via ffmpeg → `..._FINAL.mp4`)
- Format: landscape 1920x1080, 30 fps
- Duration: 165 seconds (root `data-duration="165"`)

## Source Material

- Project root: `Z:/Hackatons/Paypal`
- Primary files read: `apps/web/public/app.js` (UI copy), `docs/demo/paypal-live-receipts.json` (IDs), `apps/web/public/gallery/ai-gallery.json` (AI stats), `video-rushes/README.md`
- Product name: AFTERPACT
- Tagline: "AI can buy anything. AFTERPACT makes sure the outcome matches the promise."
- Key UI moments: Twin DIVERGENCE strip, Flight Recorder replay + CHAIN VALID, injection BLOCKED acts, gallery RECORDED badges, Studio canvas
- Copy that must appear verbatim: see brag-plan.md (tagline, RECORDED SANDBOX EVIDENCE, both URLs, three PayPal IDs + statuses)

## Creative Direction

- Tone preset: cinematic + polished
- Creative direction: "payments thriller in miniature — the footage is the argument"
- Interpretation: trailer-scale entrances on graphic cards (S3, S9), documentary restraint on footage (slow pushes, no gimmicks); SFX sparse and physical; typeijing quiet confidence
- Angle: the machine buys, the world breaks the promise, an evidence machine makes it right
- Hook: app hero pushes in from black under rising bed + "An AI agent just bought something for you."
- Outro: tagline + repo + demo URL, readable ≥4 s, bell tail
- Avoid: generic SaaS language, abstract filler, redesigning the app UI, flashing text, purple/blue gradients, gradient headlines, glassmorphism, emoji icons

## Visual Identity

- Background: #0b0e14 (all scenes); panel #11151f; foreground #e8edf5; muted #9aa7b8 (teal-tinted)
- Accent: #2dd4bf (teal); warn #f5a623 (honesty labels); bad #f26d6d (BLOCKED echo)
- Display font: Outfit 700/800 (bundled); body: Outfit 400; data/IDs: JetBrains Mono (bundled)
- Visual references: app Signature dark theme, origin-pill system, Flight Recorder timeline dots
- Footage treatment: full-bleed real captures; dark scrim only under title type (S1) and lower-thirds; grade via `media-treatment` if flat, never CSS filters

## Storyboard

Per `brag-output/paypal-ai-2026/brag-plan.md` (creative contract).

Scene summary:
1. hook — 15 s — f5 ×2 + AFTERPACT title + tagline kicker
2. promise — 23 s — clip1 + f4 + honesty lower-third
3. sandbox-card — 8 s — three real IDs assemble + RECORDED label
4. twin — 28 s — f3 + clip2; DIVERGENCE hero; whip-pan entry
5. resolution — 28 s — clip4[0-4] + f6 + clip3; approve = peak + bell
6. recorder — 18 s — f1 + hold on CHAIN VALID
7. intelligence — 20 s — clip4[5-11.6] + clip5 + "117/120" stats overlay
8. safety — 15 s — f2 + hold on BLOCKED
9. closing — 10 s — tagline + URLs; sdf-iris entry

## Audio

- Audio role: warm cinematic bed under continuous narration
- Audio arc: bed rises under hook, ducks under VO throughout, swells lightly at S5 peak, fades 158-164
- Music: happy-beats-business-moves-vol-1-by-ende-dot-app.mp3 (163.96 s; ends under fade, no loop needed)
- Music treatment: volume 0.14-0.16; fade-in 0-2 s; fade-out 158-164 s
- Music cue guidance: detect via `hyperframes beats`; lock ≤3 (S4 entry, S5 approve, S9 iris) ±0.15 s
- Audio-reactive treatment: subtle — hero glow + card presence breathe with RMS; no visualizers
- Audio-coupled moments:
  - hook line L3 — soft reveal hit
  - S4 strip reveal — soft thud
  - S5 approve click — UI click + bell
  - S6 replay clicks — 2 soft UI clicks
  - S8 BLOCKED hold — switch + thud
  - S9 tagline land — bell tail
- SFX selection guidance: cinematic sparse per audio.md; low HF risk; sounds land WITH motion
- SFX analysis guidance: `<skill-dir>/assets/sfx/sfx-analysis.md` (C:/Users/TheBox/.codex/skills/brag/assets/sfx/sfx-analysis.md)
- Exact SFX choice: Hyperframes chooses post-animation
- Audio files: copy music + selected SFX + 25 VO wavs into `composition/assets/`
- Voice: 25 per-line wavs (`assets/vo/L01.wav` … `L25.wav`), each its own `<audio>` with measured `data-start`; SRT built from the same timings

## Hyperframes Instructions

Load `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. /brag workflow — no entry-point interview, no generic promo workflow. Prefer native Hyperframes conventions.

Requirements:
- Real app footage is the central subject in S1/S2/S4/S5/S6/S7/S8; graphics only in S3/S9 + labels/overlays
- All text readable (video scale: 64 px+ headlines, 28 px+ body, 18 px+ labels); title-safe 80%
- Exactly 165 s; no overrun (clips ending past root are cut — extend nothing past)
- Music + SFX + 25 VO lines per plan; VO volumes 1.0, music ducked
- Beat-lock ≤3 moments, marked; natural timing wins over beats when readability is at stake
- `hyperframes check` zero-error gate before render; snapshot every scene midpoint + review frames
- All local; no publish step
