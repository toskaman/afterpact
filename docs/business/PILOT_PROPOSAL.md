# Two-week pilot proposal (one merchant, one exception category)

Status: PROPOSAL — no pilot customer exists. This is the offer AFTERPACT
would make, written so a merchant ops lead can say yes or no in one read.

## Scope

- One merchant account, ONE exception category (e.g. short-delivery on
  one warehouse lane). Everything else stays on the merchant's process.
- Sandbox-first: week 1 is read-only against the merchant's PayPal
  Sandbox (or AFTERPACT's mock transport replaying the merchant's
  anonymized cases). No production credentials in week 1.
- Week 2: production cases flow through AFTERPACT in
  recommend-only mode; EVERY consequential action (refund, replacement,
  escalation) needs a named human approval in the merchant's existing
  tool (email/queue approval counts; AFTERPACT records the decision).

## What AFTERPACT does in the pilot

1. Ingests the exception queue (CSV export or read-only API poll —
   whichever the merchant already has; no new integration required).
2. Builds a PurchasePromise per case from the merchant's order data,
   records observed outcomes, and flags promise/observation gaps.
3. Drafts evidence-cited resolutions; the deterministic policy gates
   every draft (Cleared/Hold/Refused) before any human sees an approval.
4. Verifies executed refunds against provider status and keeps a
   hash-chained, exportable evidence bundle per case.

What it does NOT do: auto-refund, auto-contact buyers, touch unscoped
categories, store payment credentials, or replace the merchant's ledger.

## Success criteria (all measured, week 2 vs week-0 baseline)

- Median exception handling time down ≥30% with zero approval bypasses.
- Zero over-refunds and zero duplicate refunds across pilot cases.
- ≥95% of resolutions cite complete evidence (both promise + outcome).
- Operator confidence ≥4/5 on "I understood why this action was allowed".
- Kill-switch drill: freeze → resume inside 5 minutes, no stuck cases.

## Failure / stop conditions (any one halts the pilot)

- Any unjustified or duplicate money movement, or any approval bypass.
- Provider reconciliation mismatch unresolved within 1 business day.
- Operator trust below 3/5 for two consecutive days.
- Merchant data leaves the agreed store, or a credential is mishandled.

## Data, responsibility, rollback

- Data: order/queue extracts only, merchant-anonymized where possible;
  30-day retention, merchant-owned export, deletion on request.
- Responsibility: merchant owns approvals and buyer communication;
  AFTERPACT (pilot team) owns tooling, evidence, and daily numbers.
- Rollback: kill switch freezes new actions instantly; in-flight cases
  revert to the merchant's manual queue with full evidence handoff; no
  state the merchant can't already see.

## Integration sketch (as-read, no new systems required)

Merchant queue → (CSV/API read) → AFTERPACT promise/outcome engine →
policy gate → human approval (merchant tool) → PayPal Sandbox/prod API →
provider reconciliation → evidence bundle → merchant archive.
Claimed integrations: PayPal REST (Orders/Captures/Refunds/Webhooks)
only. No Shopify/Stripe/Zendesk/NetSuite integration is claimed or
required; those are roadmap, not pilot scope.

## Price of the pilot

Fixed-fee or free-with-case-study at the merchant's choice (decision at
signing); priced to cover two weeks of tooling + daily review, not to
lock in. Production pricing follows only from measured pilot numbers
fed into `ROI_CALCULATOR.md`.
