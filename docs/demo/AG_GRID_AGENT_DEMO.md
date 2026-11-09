# AG Studio Agent Demo — Outcome Risk Analyst

Date: 2026-11-09 (TITAN VI). Sponsor target: **Best Use of AG Grid**.
Related: `docs/sponsors/AG_GRID_STATUS.md`, `docs/sponsors/ag-studio-trial.md`.

## What the judge sees

On `#/studio`, the AG Studio 3.1.0 canvas mounts over live AFTERPACT data
(promises / incidents / captures / refunds from `GET /api/studio/datasets`).
The AI Assistant panel opens with four prompt starters, including the new
**"Outcome risk briefing"**. Behind it runs a genuinely custom agent team —
not the default assistant:

- **Agent** `outcome-risk-analyst` (declared with `directLlmRunner`), whose
  instructions bind it to tool results, minor-unit money with explicit
  currency, and read-only honesty ("never claim you executed a payment").
- **Three custom tools** (declared with `api.defineAiTool`, executed
  client-side, params schema-validated by Studio):

| Tool | Reads | Answers |
|---|---|---|
| `get_incident_exposure` | live incidents | open incidents ranked by unrefunded exposure (`top_n`, capped at 50) |
| `get_promise_outcome_comparison` | live promises | promised vs observed per promise: state, approval, incidents, outcomes, evidence collected/required |
| `get_refund_verification_status` | live refunds + captures | refunds grouped by verification state (`requested/submitted/succeeded/failed`) with remaining capture balances |

Suggested judge prompt (the starter text):

> Brief me on outcome risk: list unresolved incidents by unrefunded
> exposure, compare promised versus observed outcomes, and flag refunds
> still awaiting verification.

The agent must call a `get_*` tool before stating any fact, then may use
the Studio dashboard tools (`viewSchema`, `executeQuery`, `addWidget` …)
to build the requested chart over the same sources.

## Security bounds (by construction + test)

- Tools perform **GET only** to the single allowlisted endpoint
  `/api/studio/datasets`. No POST/PUT/DELETE, no payment, capture,
  refund, approval, reset, or admin endpoint is referenced or reachable.
- Record contents are untrusted data: only known fields are read, numbers
  are coerced with fallbacks, rows and text are capped.
- The Studio abort signal is forwarded to every fetch; failures return
  tool errors (fail-closed), never fabricated rows.
- The agent cannot invoke financial actions: no such tool exists in its
  tool set, and the deterministic payment policy + human approval live
  outside the agent loop entirely.
- Proof: `tests/unit/studio-risk-tools.test.ts` (7 hermetic tests) and the
  `wires the Outcome Risk Analyst` case in
  `tests/integration/frontend.contract.test.ts`.

## How to reproduce

Keyless (CI-safe, no inference spend):

1. `npm run build`, serve, open `#/studio`.
2. The canvas mounts (trial watermark without a key) and the Assistant
   panel appears; the harness marker reads
   `data-harness-kind="outcome-risk-analyst"`.
3. `tests/e2e/studio.e2e.ts` asserts exactly this against the real 3.1.0
   bundle — custom-agent wiring proof without any model call.

Keyed (owner action, inference spend):

1. Set `VULTR_INFERENCE_API_KEY` (server-side only; never in the client).
2. Open `#/studio`, click **Outcome risk briefing**, watch the tool calls
   and the built widget. Capture a trace screenshot next to
   `docs/demo/screenshots/studio-agent-trace.png` (which covers the base
   harness loop today).

## Honest limits

- No live keyed trace of the three new tools is committed yet — producing
  one needs an inference key and is an explicit owner action. Nothing in
  this document claims such a trace exists.
- Tool results reflect demo-store contents at call time (seeded or
  judge-created runs), not production merchant activity.
- AG Studio trial licensing posture (key/consent/judging window) is
  tracked in `docs/sponsors/ag-studio-trial.md`, not here.
