# Judge Mode Guide (`#/judge`)

For hackathon judges: the fastest honest path through AFTERPACT. No account,
no keys, no setup. Public demo: `https://199.247.9.188.nip.io/#/judge`.

## The 30-second version

Headline: **"A successful payment is not a successful purchase."**

1. Click **Run the flagship scenario**.
2. Watch Acts 1–9: intent → discovery → approval → payment → incident →
   resolution → verified recovery → flight recorder → studio.
3. Follow **Open in Outcome Twin** and **Replay in Flight Recorder**.

Every act carries an origin pill (`SIMULATED · MOCK`, `REAL API`,
`RECORDED …`). Nothing simulated is presented as live.

## The four scenario cards (Recover · Hold · Refuse · Proof)

| Card | What it runs | What it proves |
|---|---|---|
| 1 — Recover | `POST /api/demo/run` (`flagship`): 3 kits promised, 2 delivered, bounded partial refund | The full outcome loop incl. approval + verified recovery |
| 2 — Hold | `POST /api/demo/run` (`hold`): promise with NO approval; policy evaluates to Hold, order refused | Restraint is real: no order record, nothing charged |
| 3 — Refuse | `POST /api/demo/run` (`injection`): merchant-swap + amount-increase attempts | Deterministic policy REFUSES both; evidence in `policy.blocked` |
| 4 — Provider-verified proof | Read-only: two recorded PayPal Sandbox loops (partial + full refund) | Real provider execution happened and is inspectable |

Card 4 cites `docs/demo/paypal-live-receipts.json` (loop 1, partial
`8DJ895035B173303G`) and `docs/demo/paypal-live-receipts-2.json` (loop 2,
full `15T12360RX6158212`). Sandbox test money, credentials redacted.

Card 2 (`hold`) asserts the verdict the policy engine actually returns
(`Hold`/`approval-missing` via `GET /api/promises/:id`) and re-reads the
stored promise to prove no order was created — the scenario fails loudly
instead of faking a Hold badge.

## Honest boundaries (read before judging)

- The hosted demo runs the **mock PayPal transport** (`MOCK · SIMULATED`
  pill, top-right + page badge). No secrets live on the box.
- **Live AI is OFF** on the hosted box (no inference key, by design). The
  AI Evidence Gallery (`#/ai-gallery`) shows authentic recorded model runs
  labeled `RECORDED VERIFIED AI RUN` — replay, never fake live inference.
- Demo runs you start are resettable only with your own browser's reset
  token; you cannot delete other visitors' runs. The audit chain is
  append-only.
- Screenshot: `docs/demo/screenshots/judge-mode.png` (current 4-card
  layout, keyless pills). E2E: `tests/e2e/judge.e2e.ts` (5 tests incl.
  Hold, mobile viewport + keyboard, green in CI) +
  `tests/e2e/tour.e2e.ts` (3 tests: landing funnel, 60-second tour with
  per-step proof links, result copy/reset).
