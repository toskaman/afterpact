# PayPal chaos campaign (TITAN III §4.2)

Seeded, deterministic fault injection over `MockPayPalTransport`
(`failNextWith` one-shot faults + real `KeyedMutex` serialization). No
network, no sleeps, no real money. Suite:
`tests/integration/paypal.chaos.test.ts` (9 tests, ~1 s).

## Invariants proven

| # | Scenario | Result |
|---|---|---|
| 1 | 25 sequential same-key captures | 1 provider call, 24 replays, 1 capture |
| 2 | 20 parallel same-key captures | exactly 1 winner, 1 provider call |
| 3 | 2 racing 2000c refunds on 2500c capture | 1 wins, 1 `RefundBoundsError`, total 2000c |
| 4 | Drain 1000c + 1500c, then 1c | exact drain, final cent refused |
| 5 | 500 on capture | retryable error, zero partial state, retry settles |
| 6 | 429 on refund | retryable error, `failed` marker journaled (consumes no bounds), retry settles |
| 7 | 504 on create, same-key retry | single order, no duplicate |
| 8 | Refund webhook before capture exists | `ignored`, no crash; links once capture lands |
| 9 | Approval webhook ×5 redeliveries | applied once, 4 duplicates, 1 audit entry |

## Findings

- Two initial failures were test bugs (missing `reason`, sub-8-char
  idempotency keys), not product bugs — verified by reading the exact
  `ZodError` / `InvalidIdempotencyKeyError` before fixing the tests.
- Failed attempts journal a `failed` refund marker; bounds count only
  `submitted`/`succeeded`, so retries are never starved by their own
  history (`store.refundedMinorForCapture`).
- No crash-recovery scenario is claimed: restart-during-pending-refund
  is NOT covered (single-node JSON store, see persistence decision).
  This report claims only what the suite runs.
