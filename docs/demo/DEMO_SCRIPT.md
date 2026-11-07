# AFTERPACT demo script — “The Purchase That Went Wrong”

Audience: hackathon judges. Total: see the <3-min video shot list at the
end; the live walkthrough below runs ~10 minutes with Q&A.

## Setup (before the audience arrives)

1. `npm ci && npm run build && npm start` (or open the Render URL).
2. Reset to a clean slate: `POST /api/demo/reset` (mock mode) or the
   Demo view's reset button.
3. Top-bar check: transport pill reads `MOCK · SIMULATED` (keyless) or
   `PAYPAL SANDBOX · LIVE` (keyed); chain pill reads `CHAIN VALID`.
4. If demoing live discovery, confirm `#/discovery` status is `live`;
   otherwise rehearse the unconfigured branch (it is part of the story:
   "without a key we show nothing — we never fake it").
5. Open tabs: `#/demo`, `#/studio`, `#/discovery`, `#/timeline`.

## Narration (live walkthrough)

**0:00 — Problem (30s).** "Agents can buy anything. Nothing holds the
receipt. When delivery goes wrong there is no machine-verifiable record
of what was promised, no bound on what the agent may concede, and no
auditable recovery. AFTERPACT is the assurance layer: every purchase
becomes a promise, every promise is verified, every failure is recovered
with proof."

**0:30 — Flagship, Acts 1–4 (2 min).** Run `#/demo` → Flagship.
- Act 1: NL request becomes a structured goal (labeled heuristic parse —
  "we tell you exactly what parsed it").
- Act 2: discovery. Keyed: live Channel3 candidates with sources;
  keyless: labeled catalog fallback. Either way: "discovery never
  authorizes checkout — payment routes to the explicitly authorized
  sandbox merchant."
- Act 3: the exact transaction is approved — version, hash, amount.
- Act 4: PayPal order + capture. Keyed live: pause at the real PayPal
  approval URL ("real buyer approval, real sandbox"); mock: labeled
  simulated buyer.

**2:30 — Acts 5–7, the tail competitors omit (2 min).**
- Act 5: short delivery observed; the gap detector raises an incident
  with category + severity.
- Act 6: a $129.99 partial refund is proposed — validated against
  capture bounds, awaiting a human decision. "The agent proposes; the
  human disposes."
- Act 7: approval executes a provider refund; the case closes
  `RESOLUTION_VERIFIED` with the provider refund id on screen.

**4:30 — Proof, not slides (2 min).**
- Act 8: Flight Recorder — hash-chained, replayable, exportable.
  Download the redacted JSON: "this is the artifact merchant-ops keeps."
- Act 9: the Studio regenerates from the same live data. Open `#/studio`,
  run `incidents unresolved refunds >$100`, click a promise row to
  cross-filter. "AG Grid Community tables, real rows — and we label what
  we don't use: AG Studio is explicitly not claimed."
- Open `#/timeline?promiseId=…`: "the incident rescheduled delivery —
  computed from state, dependencies intact."

**6:30 — The attack (1 min).** Run the injection scenario: merchant-swap
and amount-increase attempts are both `blocked` with exact policy
reasons, preserved in the recorder. "The policy engine is deterministic:
same input, same refusal, forever."

**7:30 — Close (30s).** Recap the arc on `#/tx/:id`: one promise, one
capture, one verified refund, one chain. "AI can buy anything. AFTERPACT
makes sure the outcome matches the promise."

## Q&A cheat sheet

- "Is PayPal real?" — Yes when keyed (sandbox ids on screen); the mock
  transport is deterministic and always labeled. Live mode is disabled
  in code.
- "Where is the AI?" — Deterministic today (parse, rank, detect, draft,
  filter), each labeled; no LLM inference is claimed. The agent loop
  (propose → human gate → execute → verify) is the agentic story.
- "Channel3 without a key?" — Unconfigured state, HTTP 503, zero
  fabricated rows. Set the key and the same UI goes live.
- "AG Studio? Bryntum?" — Not used, not claimed; Community tables and a
  real fallback timeline instead, with documented upgrade paths.

## Video shot list (<3:00, hard cap 2:50)

| Time | Shot | Narration |
|---|---|---|
| 0:00–0:15 | Title card + problem statement | "Agents can buy anything. Nothing holds the receipt." |
| 0:15–0:45 | `#/demo` flagship run, Acts 1–4 timelapse | Intent → discovery → approval → PayPal capture |
| 0:45–1:15 | `#/tx/:id` + `#/recovery` | Short delivery → incident → $129.99 proposal → verified refund id |
| 1:15–1:40 | `#/recorder` replay + export download | "Every step hash-chained and exportable." |
| 1:40–2:05 | `#/studio` NL command + cross-filter | "Live analytics over the same data." |
| 2:05–2:20 | `#/timeline` shifted bars | "The incident rescheduled recovery — computed, not drawn." |
| 2:20–2:35 | Injection run, both `blocked` | "Attacks fail closed with exact reasons." |
| 2:35–2:50 | Closing card: repo + demo URL + tagline | "AFTERPACT makes sure the outcome matches the promise." |

Recording rules: footage of the running app only (no mockups); keep the
transport/origin pills visible in every shot; label the sandbox vs mock
segments in captions; no unlicensed music/trademarks; public YouTube link.
