# AFTERPACT — Commercial Strategy

> Status: hypotheses only. No customer interviews, pilots, or pricing
> validation have been conducted. Every number below is an explicitly
> labeled assumption to be tested, not a claim.

## Initial customer profile

**Primary:** merchant operations teams and marketplaces that already handle
transaction exceptions (missing/incorrect/late deliveries, partial service,
duplicate charges). They own the refund queue, the evidence gathering, and
the audit trail — today mostly manual.

**Why them first:** they feel the pain daily, they can trial on one
high-exception category, and they control the PayPal sandbox + production
credentials needed for a pilot. One persona, one queue, one integration.

**Secondary (later):** enterprise procurement, AI commerce platforms, SaaS
vendors operating transaction agents, B2B service marketplaces. Explicitly
out of scope for the current build.

## Problem severity (assumption set P1–P4)

- P1: exception rate 2–8% of agentic orders by volume (to validate per merchant).
- P2: manual exception handling costs 15–45 min operator time per case.
- P3: inconsistent evidence → slow merchant responses, unresolved disputes.
- P4: failed/duplicate compensation attempts create financial leakage.

Validation plan: 5 ops-team interviews + 1 shadowed refund queue before any
pricing conversation.

## Transaction volume assumptions

Pilot target: merchants processing 1k–50k PayPal transactions/month with a
visible exception queue. AFTERPACT prices on incidents processed, so volume
below ~200 incidents/month is served by the flat tier.

## Existing alternatives

Manual ops queues, marketplace admin panels, pre-purchase budget guards
(`docs/competition/COMPETITIVE_LANDSCAPE.md`), generic dispute tooling.
None combine: structured commercial promise + outcome verification +
policy-gated authorized recovery + hash-chained audit trail.

## Buying process and objections

Buyer: Head of Ops / Marketplace Ops lead. Objections to expect: "another
dashboard", financial-action autonomy fears, PayPal permission scope,
evidence admissibility questions. Answers: scoped tools + human approval by
default, read-only trial mode, redacted evidence export, kill switch.

## Commercial offering (hypotheses)

- **Starter** (flat): one merchant account, one exception category, manual
  approvals — trial wedge.
- **Growth** (SaaS + usage): multi-category, policy automation levels,
  Studio analytics, Postman/API access; per-incident fee above included volume.
- **Enterprise**: SSO/audit retention, custom policies, procurement integrations.

Prices are hypotheses until validated — no figures are quoted here on purpose.

## Go-to-market (first 90 days, hypothetical)

1. Publish sandbox demo + evidence bundle; 2. five ops-team design reviews;
3. one paid pilot on a single exception category with success criteria
(time-to-resolve, evidence completeness, leakage prevented); 4. convert or
kill per pilot data.
