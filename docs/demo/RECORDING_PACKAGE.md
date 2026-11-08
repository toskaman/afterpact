# AFTERPACT recording package — final video 2:40–2:50 (owner records)

> Companion to `docs/demo/DEMO_SCRIPT.md` (live 10-min walkthrough). This
> file is the exact shot plan for the <3:00 submission video. Status:
> PACKAGE READY — no video file exists yet (`TBD:youtube-url`).

## Pre-flight checklist (do not skip)

1. Fresh state: Demo view → reset (or `POST /api/demo/reset`); confirm
   top-bar pills: transport + `CHAIN VALID`.
2. Tabs open in order: `#/demo`, `#/twin`, `#/recovery`, `#/recorder`,
   `#/studio`, `#/ai-gallery`.
3. Console open on a second monitor: zero errors required in every shot;
   re-record any shot with a red line.
4. Resolution 1920×1080, UI at 100%, dark theme (Signature theme shows
   best); cursor highlighting on.
5. Decide the PayPal segment: keyed sandbox (real approval URL + real
   ids) or mock (labeled) — caption whichever it is, never mix without a
   caption. AI segment uses `#/ai-gallery` (RECORDED VERIFIED AI RUN) +
   on-screen `AI · LIVE` badges where keyed; never narrate a replay as live.

## Shot plan

| Time | View + action | Narration (EN) | On-screen proof |
|---|---|---|---|
| 0:00–0:18 | Title card → `#/demo` landing | "AI can buy things. But who makes sure the promise is actually fulfilled?" | Problem statement, product tagline |
| 0:18–0:45 | `#/demo` → Flagship Acts 1–4 (timelapse ok) | Intent → structured promise → approval → PayPal execution | Promise hash + approval; order/capture ids; transport pill visible |
| 0:45–1:15 | `#/twin?promiseId=…` DIVERGENCE strip + 3 columns | "A short delivery violates the promise. The Twin shows promised, observed, recovered." | DIVERGENCE strip; violation → evidence → correction; SIMULATED LOGISTICS badge on the delivery event |
| 1:15–1:50 | `#/recovery` AI analysis → proposal → approve → verified refund | "AI analyzes the evidence, policy checks it, a human approves, PayPal confirms." | Cited analysis; Cleared verdict; approval; provider refund id + status |
| 1:50–2:10 | `#/recorder` replay + export download | "Every step hash-chained and exportable." | CHAIN VALID; redacted JSON download |
| 2:10–2:35 | `#/studio` agent prompt → widget builds from live data | "Analytics over the same live data — the agent builds the widget." | Canvas + agent turn + resulting widget; Community tables below |
| 2:35–2:50 | Closing card: repo + demo URL + tagline | "AFTERPACT doesn't stop when payment succeeds. It verifies that the commercial outcome matches the promise." | URLs on screen, readable ≥4 s |

## Rules (recording)

- Running app only — no mockups, no slideware substitutions.
- Origin pills visible in every shot; sandbox-vs-mock captioned.
- AI gallery shots keep the RECORDED VERIFIED AI RUN badge in frame.
- No secrets on screen (keys stay in `.env`, never in the browser).
- No unlicensed music/trademarks; EN voiceover + readable subtitles.
- Hard cap 2:50; publish unlisted-or-public on YouTube; replace
  `TBD:youtube-url` in `DEVPOST_DRAFT.md` with the real link and verify
  it plays logged-out.
