# Operator impact: manual vs AFTERPACT-assisted incident handling

Controlled self-test (author-measured, no independent users — see Q84 FAIL).
Compares the documented manual procedure against the measured assisted run
for the same case: short delivery (2 of 3 kits), partial refund of the
missing share, verified settlement.

## Manual procedure (documented walkthrough, times estimated ±50%)

Merchant-ops handling with PayPal dashboard + ticket + spreadsheet:

| # | Touchpoint | Est. |
|---|---|---|
| 1 | Notice the complaint in the ticket queue, triage | 2 min |
| 2 | Find the order in the PayPal dashboard (search, filters) | 3 min |
| 3 | Compare order vs carrier/delivery records by hand | 5 min |
| 4 | Compute the refundable share (unit price × missing qty) by hand | 3 min |
| 5 | Check remaining capture minus prior refunds by hand | 3 min |
| 6 | Confirm approval policy / chase a manager | 5 min |
| 7 | Issue the refund in the dashboard | 2 min |
| 8 | Record outcome in ticket + spreadsheet, re-verify settlement later | 5 min |

Total ≈ 28 min across **8 touchpoints**, 2+ hand computations, no
tamper-evident trail (a spreadsheet row). Consistent with the 15–45 min/case
hypothesis range (P1–P4); the range itself remains unvalidated by interviews.

## Assisted run (measured, `scripts/operator-benchmark.mjs`)

Same case through AFTERPACT (mock transport, `:memory:` store):

| # | Step | Operator load | Measured machine time |
|---|---|---|---|
| 1 | Record outcome → incident auto-detected with category/severity | read (1 min est.) | 5 ms |
| 2 | Diagnose: deterministic gaps + AI analysis with citations | read (1 min est.) | 4 ms fallback / ~4 s live model |
| 3 | Propose partial refund (kind + amount + rationale) | **1 decision** | 4 ms |
| 4 | Approve → policy gate + bounded refund + provider verify | **1 decision** | 5–6 ms |
| 5 | Verify in Flight Recorder (chain valid, refund receipt) | **1 verification** | 2 ms |

Totals: **3 operator decisions**, 0 hand computations, machine time 20 ms
(fallback) / ~4 s (live model adds one ~4 s inference call on step 2).

Reproduce: start the API with `AFTERPACT_DATA_DIR=:memory:` and mock
transport, then `BASE_URL=... node scripts/operator-benchmark.mjs`.

## What the comparison shows (and does not)

| Dimension | Manual | Assisted | Basis |
|---|---|---|---|
| Operator touchpoints | 8 | 3 | procedure docs vs measured flow |
| Hand computations | amount + remaining-capture math | 0 (policy engine + gates) | code, `refund.ts` bounds tests |
| Policy checks | manual lookup / manager chase | automatic verdict (Cleared/Hold/Refused) per action | 22 policy unit tests |
| Over-refund protection | operator diligence | refused at two bounds (local + provider) | `refund.ts`, safety tests |
| Audit trail | spreadsheet row | hash-chained, replayable, exportable | chain tests, redacted export |
| Operator wall time | ~28 min (est.) | ~3 min (est.) + seconds machine | estimates, NOT measured users |

Not claimed: no percentage savings, no measured human timings, no
independent-user validation. The machine-time row proves the tool adds no
friction; the decision-count row is the structural claim (fewer places for
an operator to err). A lab study with independent operators would be needed
to promote the time estimates to findings.
