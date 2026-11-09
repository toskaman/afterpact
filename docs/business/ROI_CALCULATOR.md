# Merchant ROI calculator (editable model, assumptions labeled)

Status: MODEL ONLY — every default is an `ASSUMPTION`. No AFTERPACT
customer, pilot, or measured saving exists. Replace assumptions with the
merchant's own numbers (or pilot measurements) before quoting anything.

## Inputs (fill with the merchant)

| # | Variable | Meaning | Default | Source |
|---|---|---|---|---|
| 1 | `V` | orders/month | 20,000 | ASSUMPTION |
| 2 | `r` | share of orders raising a payment/delivery exception | 1.5% | ASSUMPTION |
| 3 | `t_m` | mean manual handling time per exception (min) | 28 | ESTIMATE (see `IMPACT_BENCHMARK.md`; NOT measured) |
| 4 | `c_h` | loaded ops cost per hour (currency/h) | 45 | ASSUMPTION |
| 5 | `q` | share of exceptions recoverable (refund/replacement due) | 40% | ASSUMPTION |
| 6 | `a` | mean recoverable amount per recoverable exception | 32.00 | ASSUMPTION |
| 7 | `l` | leakage: recoverable value currently lost (missed/duplicated) | 12% | ASSUMPTION |
| 8 | `t_a` | mean assisted handling time per exception (min) | 6 | ASSUMPTION (needs usability sessions) |
| 9 | `f` | AFTERPACT fee/month (same currency) | 900 | ASSUMPTION (pricing hypothesis) |
| 10 | `s` | one-off integration cost (same currency) | 4,000 | ASSUMPTION |

## Formulas (all in the merchant's currency)

- Exceptions/month: `E = V × r`
- Manual labor/month: `L_m = E × (t_m / 60) × c_h`
- Assisted labor/month: `L_a = E × (t_a / 60) × c_h`
- Labor saved/month: `S_L = L_m − L_a`
- Leakage recovered/month: `S_R = E × q × a × l`
  (AFTERPACT's bounded, evidence-gated recovery is assumed to capture the
  currently-leaked share; the pilot must measure this, not assume it.)
- Net/month: `N = S_L + S_R − f`
- Payback (months): `s / N` (only if `N > 0`)

## Worked example (defaults — illustration, NOT a result)

`E = 300`; `L_m = 6,300`; `L_a = 1,350`; `S_L = 4,950`;
`S_R = 300 × 0.40 × 32 × 0.12 = 460.80`; `N = 4,510.80`;
payback ≈ 0.9 months. Change any input and the conclusion moves — that is
the point of this sheet: argue from the merchant's numbers, not ours.

## What would turn this into evidence

1. Run the usability pack (`USABILITY_FACILITATION_PACK.md`) to measure
   `t_a` and task success on real operators.
2. Run the 2-week pilot (`PILOT_PROPOSAL.md`) to measure `q`, `l`, and
   avoided errors on the merchant's own exception mix.
3. Recompute with measured values and report the range, not one number.

Anti-claims: do not present the worked example as an AFTERPACT outcome;
do not cite `t_m = 28` as measured; do not promise leakage capture —
policy gates refuse unjustified refunds by design, which reduces `S_R`
whenever the evidence is weak.
