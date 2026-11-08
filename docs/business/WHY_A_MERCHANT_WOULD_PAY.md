# WHY A MERCHANT WOULD PAY FOR AFTERPACT

> Enterprise product case, not hackathon hype. Every figure is labeled
> MEASURED (machine-recorded in this repo), ASSUMED (explicit hypothesis),
> or UNVALIDATED (needs interviews/pilot). No customer interviews, pilots,
> or revenue exist today.

## 1. Who buys it

**Merchant Operations Manager responsible for payment and delivery
exceptions** — the person who owns the refund queue, gathers evidence for
disputes, and explains leakage to finance. Secondary approver: Head of Ops
/ Marketplace Ops lead (budget holder). Technical sponsor: the engineer who
holds the PayPal API credentials.

The buyer is NOT the end consumer and NOT the checkout team: AFTERPACT
lives in the lifecycle tail (verification → exception → resolution), where
ops teams already spend their days.

## 2. What budget it comes from

Operations labor budget (exception-handling headcount) and loss-prevention /
leakage budget (duplicate and over-refunds). It complements — never
replaces — the PayPal processing relationship: AFTERPACT adds no
per-transaction PayPal fee; it sits on incidents processed. Pilot pricing
hypothesis (ASSUMED, unvalidated): flat starter tier below ~200
incidents/month, usage above that — see
`docs/business/COMMERCIAL_STRATEGY.md`.

## 3. Which tools it complements

PayPal dashboard (execution surface), ticket queues (intake), spreadsheets
(today's audit trail), marketplace admin panels, and — once disputes
escalate — dispute-copilot tooling. AFTERPACT does not re-implement
checkout, pre-purchase budget guards, or dispute rebuttals; it fills the
verified-result gap between payment and closure that none of them cover
(see `docs/competition/COMPETITIVE_LANDSCAPE.md`).

## 4. What financial problem it reduces

Three costed pains (ASSUMED magnitudes, MEASURED structure):

| Pain | Manual today (ESTIMATED ±50%) | AFTERPACT-assisted (MEASURED flow, ESTIMATED read time) |
|---|---|---|
| Operator minutes per case | ~28 min across 8 touchpoints | 3 operator decisions + seconds machine time (~3 min est. read) |
| Hand computations | amount + remaining-capture math by hand | 0 — policy engine + gates |
| Over/duplicate refunds | operator diligence | refused at two bounds (local + provider), test-proven |
| Audit trail | spreadsheet row | hash-chained, replayable, exportable bundle |

Source: `docs/benchmarks/OPERATOR_IMPACT.md` (controlled self-test, same
case both paths; NOT measured human timings — see §7). Machine overhead is
20 ms fallback / ~4 s with one live inference call: the tool adds no
friction; the structural claim is fewer places for an operator to err.

Illustrative value sketch (ASSUMED rates): 30 min at €30/h fully loaded =
€15/case manual vs ~€2.50/case assisted → ~€12.50/case gross value before
AFTERPACT fees. A usage fee must sit well under that delta. The pilot must
measure H1–H3 (`UNIT_ECONOMICS.md`) before any price is quoted.

## 5. Why this beats manual workflows

1. **Fewer decisions, not faster clicks.** 8 touchpoints collapse to 3
   decisions (diagnose → propose → approve/verify) because detection,
   bounds-checking, and evidence assembly are automatic.
2. **Bounds the agent can never cross.** Approvals bind to promise version
   + hash and expire; refunds cannot exceed captured funds; idempotency is
   replay-before-gate; a kill switch halts execution. Manual ops has none
   of this — diligence is the only control.
3. **Evidence merchants and auditors accept.** Every incident ships with
   cited observations, policy verdicts, and a hash-chained export —
   the artifact ops keeps for disputes instead of a spreadsheet row.
4. **Injection-proof by construction.** Merchant-swap and amount-increase
   attempts are `blocked` with exact policy reasons, preserved as
   evidence — deterministic, same input same refusal.

## 6. Why agentic-commerce growth makes this urgent

Shopping agents already browse, compare, and check out — but a successful
payment is not a successful purchase. As agents place more orders, the
exception queue grows with volume while ops headcount does not, and
pre-purchase guards (the dominant hackathon pattern) say nothing about
whether delivery matched the promise. AFTERPACT is the assurance layer for
the world where agents buy at machine speed and humans must still vouch
for outcomes.

## 7. What could block adoption (honest limitations)

- **No independent user validation yet.** All time figures are estimates;
  the lab-study package is ready (`docs/benchmarks/USABILITY_STUDY.md`)
  but no external session has run. An enterprise pilot starts here.
- **Single-node JSON persistence.** Documented limitation; SQLite/PostgreSQL
  migration is future work. Fine for pilot scale, not for enterprise volume.
- **Financial-action autonomy fears.** Mitigated by design: human approval
  by default, scoped tools, read-only trial mode, kill switch — but the
  buyer's security review still has to pass.
- **PayPal permission scope + evidence admissibility.** Pilot defines the
  minimal credential scope and confirms the export format satisfies the
  merchant's dispute SOPs before any rollout.
- **SOC 2 / procurement.** Not started; enterprise deals stall without it
  (see `COMPETITIVE_MOAT.md` 12-month conditions).

## 8. What maturity an enterprise pilot requires

Minimum viable pilot: one merchant account, one exception category, manual
approvals, read-only trial mode available, redacted evidence export, kill
switch, and success criteria agreed up front (time-to-resolve, evidence
completeness, leakage prevented). That is exactly the current build's
shape — the pilot measures H1–H3, then convert-or-kill per data.
