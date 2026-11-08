# Brag plan: AFTERPACT — PayPal AI Hackathon submission film

Output dir: `brag-output/paypal-ai-2026/`. Format landscape 1920x1080,
30 fps, 165 s (2:45, hard cap <180 s). Tone: cinematic + polished —
trailer-scale restraint for a fintech jury. Voice: ON (Kokoro af_heart,
per-line wavs). Music: ende.app vol-1 bed, low + ducked, fade-out tail.

## Rubric (9 answers)

1. Product: AFTERPACT — assurance layer for agentic commerce.
2. Strongest claim: "AI can buy anything. AFTERPACT makes sure the outcome matches the promise."
3. Key UI moment: Outcome Twin divergence strip (promised/observed/recovered).
4. Proof: Flight Recorder hash chain + provider-verified PayPal refund.
5. AI story: recorded verified model runs (117/120) + live Studio analytics.
6. Safety story: injection double-block with exact policy reasons.
7. Honesty system: SIMULATED pills in footage, sandbox IDs card labeled RECORDED, gallery labeled RECORDED VERIFIED AI RUN, trial watermark visible.
8. Audience: PayPal judges (engineers, PMs, Dev Advocates) + AG Grid sponsor.
9. CTA: repo + demo URL on closing card (≥4 s readable).

## Angle

A payments thriller in miniature: the machine buys, the world breaks the
promise, and an evidence machine makes it right — every claim inspectable.
No hype adjectives; the footage is the argument.

## Hook (0-3 s)

Black → hero app frame pushes in under a rising bed; VO: "An AI agent just
bought something for you." Type: AFTERPACT / the assurance layer for
agentic commerce. SFX: soft reveal hit under "Who makes it right?" (~7 s).

## Storyboard (scene = sub-composition; footage = real app captures)

| # | Scene | Time | Visual | VO lines |
|---|---|---|---|---|
| S1 | hook | 0-15 | f5 hero hold ×2 + title type over dark scrim | L1-L3 |
| S2 | promise | 15-38 | clip1 flagship run (11.2) + f4 promise detail (11.8 trimmed); lower-third "Demo transport: SIMULATED · sandbox proof follows" | L4-L6 |
| S3 | sandbox-card | 38-46 | Motion graphic: real IDs order 2ER387580K033722V / capture 7R158417X9367771B / refund 8DJ895035B173303G $129.99 COMPLETED; label "RECORDED SANDBOX EVIDENCE · api-m.sandbox.paypal.com · 2026-11-08" | L7 |
| S4 | twin | 46-74 | f3 twin long (17.0) + clip2 (9.7) + hold; shader whip-pan entry; DIVERGENCE strip is the hero frame | L8-L11 |
| S5 | resolution | 74-102 | clip4[0-4] recorded run → f6 gate card (12) → clip3 approve (11.4); PEAK = approve click + success bell | L12-L15 |
| S6 | recorder | 102-120 | f1 (15.6) + hold on CHAIN VALID; replay clicks audible | L16-L18 |
| S7 | intelligence | 120-140 | clip4[5-11.6] gallery filter + clip5 studio (9.4) + stats overlay "117/120 · deepseek-v4.1-flash-1017 · every citation checked" | L19-L21 |
| S8 | safety | 140-155 | f2 injection (12.7) + hold on BLOCKED pills | L22-L23 |
| S9 | closing | 155-165 | Card: tagline + github.com/toskaman/afterpact + https://199.247.9.188.nip.io; shader iris entry; bell tail | L24-L25 |

Rhythm: hold-build-PROOF(beat)-hold-PEAK-hold-punch-hold. Transitions:
blur-through 0.25 s default; whip-pan shader into S4; sdf-iris into S9;
hard cuts inside footage chains.

## Voiceover script (25 lines; contractions, literal numbers)

L1 An AI agent just bought something for you.
L2 The payment succeeded. But the delivery went wrong.
L3 Who makes it right?
L4 Meet Afterpact — the assurance layer for agentic commerce.
L5 Every purchase becomes a structured promise: exact items, exact amount, exact merchant — approved to the version and the hash.
L6 Then PayPal executes. Real orders. Real captures.
L7 Recorded sandbox runs prove the loop end to end.
L8 But here's what nobody shows you.
L9 Three sensor kits were promised. Two arrived.
L10 The Outcome Twin lays it bare: what was promised, what actually happened — and what's still missing.
L11 One kit. A hundred twenty-nine dollars and ninety-nine cents. Unaccounted for.
L12 So Afterpact goes to work.
L13 AI reads the evidence and proposes a partial refund.
L14 A deterministic policy checks every cent against the capture.
L15 A human approves. And PayPal confirms the refund — verified at the provider, not just on screen.
L16 Every step lands in the Flight Recorder.
L17 A hash-chained, replayable record you can hand to your ops team — or your auditor.
L18 This isn't a demo trick. It's the artifact merchants keep.
L19 The same evidence powers real intelligence.
L20 Recorded model runs — every citation checked — and a live analytics studio over the same data.
L21 Nothing here is faked. And everything is labeled.
L22 And when something malicious shows up — a merchant swap, an inflated amount —
L23 the policy engine refuses. Same input, same refusal. Forever.
L24 AI can buy anything.
L25 Afterpact makes sure the outcome matches the promise.

Word count ≈ 270 → ≈110 s VO over 165 s (breathing room per narration.md).

## Copy that must appear verbatim

- "AI can buy anything. AFTERPACT makes sure the outcome matches the promise."
- "RECORDED SANDBOX EVIDENCE" (S3 card)
- "github.com/toskaman/afterpact" + "https://199.247.9.188.nip.io" (S9)
- Order/capture/refund IDs + statuses (S3, from paypal-live-receipts.json)

## Music cue guidance

Track vol-1 (163.96 s): detect at composition via `hyperframes beats`;
bias major reveals (S4 entry, S5 approve, S9 iris) toward strong beats
±0.15 s; 1-3 locks only; readability first. Bed 0.14-0.16 under VO,
fade 158-164.

## SFX (cinematic sparse, ≤8)

Hook hit ~7 s; S4 strip reveal ~48 s; UI clicks on 2-3 visible presses
(0.55); approve + impactBell at peak ~92 s; refusal switch+thud ~146 s;
outro bell ~158 s. Choose exact files post-animation per sfx-analysis.

## Grounding

Every on-screen ID, amount, status, and model name quotes repo artifacts
(receipts JSON, gallery JSON, app UI). No invented figures. Mock footage
keeps its SIMULATED pills; nothing narrates mock as live.
