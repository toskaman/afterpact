# WHY AFTERPACT IS DIFFERENT

> Evidence-backed positioning vs observed 2026 PayPal-hackathon entries.
> Full per-entry evidence in `docs/competition/COMPETITIVE_LANDSCAPE.md`
> (15+ submissions inspected; snippet-only entries marked). No "world
> first" claims — only cited lifecycle gaps. Fresh names checked
> 2026-11-08: Cobra, ClearLedger AI, Payment Review Copilot (§4);
> 2026-11-09: OmegaCommerce (Devpost page opened — closest AG Grid rival).

## The one-line thesis

**AFTERPACT is an outcome-assurance control plane for agentic
transactions.** It does not make agents safer *before* checkout — it
connects the original commercial promise to the actual post-payment
outcome and the verified financial resolution.

## The 13-stage commercial lifecycle

Stages: 1 intent · 2 merchant selection · 3 financial authorization ·
4 payment execution · 5 promise verification · 6 post-purchase evidence ·
7 incident identification · 8 recovery planning · 9 human approval ·
10 real refund execution · 11 provider reconciliation · 12 audit replay ·
13 operational analytics. ● = implemented with seen evidence · ◐ =
partial · ○ = absent in seen evidence · ? = snippet-only, unclear.

| Entry (evidence) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mandate/MuhammadNabiyev (README) | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ | ◐ | ○ |
| Mandate/Chinorab (README) | ● | ● | ● | ● | ○ | ● | ○ | ○ | ● | ○ | ○ | ● | ● |
| Leash (live site) | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ◐ | ○ | ◐ | ○ |
| Allowance (README) | ● | ● | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ | ● | ● |
| AgentTab (not PayPal) | ○ | ○ | ◐ | ○ | ○ | ○ | ◐ | ○ | ● | ○ | ○ | ○ | ○ |
| PayGuard variants (?) | ◐ | ○ | ◐ | ◐ | ○ | ○ | ○ | ○ | ◐ | ◐ | ○ | ○ | ○ |
| AgentGuard/IntentLock (?) | ● | ○ | ● | ● | ○ | ○ | ○ | ○ | ● | ○ | ○ | ○ | ● |
| Merchant-guard cluster (?) | ○ | ○ | ○ | ○ | ○ | ◐ | ○ | ◐ | ● | ◐ | ○ | ○ | ○ |
| Escrow cluster (?) | ○ | ○ | ● | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Dispute copilots (?) | ○ | ○ | ○ | ○ | ○ | ● | ○ | ◐ | ● | ◐ | ○ | ◐ | ○ |
| Cobra (snippet, §4) | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ |
| ClearLedger AI (snippet, §4) | ○ | ○ | ○ | ○ | ◐ | ◐ | ○ | ○ | ○ | ○ | ? | ○ | ○ |
| OmegaCommerce (Devpost page, 2026-11-09) | ● | ○ | ◐ | ● | ○ | ● | ○ | ○ | ◐ | ○ | ◐ | ◐ | ● |
| **AFTERPACT (this repo)** | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |

Reading the table: 90%+ of observed entries implement stages 1–4 + 9 and
stop at a ledger. The escrow cluster verifies only hold-phase code
deliverables (AUTHORIZE → verify → CAPTURE/VOID), not ordinary captured
purchases. Dispute copilots start at `CUSTOMER.DISPUTE.CREATED` — they
never verify delivery early. **Nobody observed owns the full 5 → 12 tail
(verification → exception → resolution → verified result) for captured
PayPal payments.** That tail is AFTERPACT's position.

## Three defensible advantages (to be earned, not claimed as moats)

Per `docs/business/COMPETITIVE_MOAT.md`, no durable moat exists today.
Candidates:

- **A. Verifiable execution.** End-to-end chain promise → approval →
  payment → outcome → recovery → provider confirmation, hash-chained and
  replayable. Competitors show ledgers; AFTERPACT shows proof.
- **B. Domain-specific recovery intelligence.** 53-scenario AI eval corpus
  + exception taxonomy + policy packs, grown per vertical across pilots.
- **C. Integration depth.** Reconciliation edge cases, capture/refund
  bounds, webhook dedupe — unglamorous coverage that compounds.

## Fresh names (2026-11-08, snippet-level)

- **Cobra** — "AI collections agent for freelancers paid with PayPal: bill
  in one sentence or voice note, and Cobra drafts, sends and chases your
  PayPal invoices." Merchant-side invoicing automation; no promise/outcome
  verification loop visible. Adjacent, not overlapping.
- **ClearLedger AI** (paypal-ai-reconciliation) — "helps a shop understand
  how its order expectations compare with verified payment evidence."
  Nearest neighbor to AFTERPACT's verification stage at snippet level, but
  no evidence of incident workflow, recovery planning, or refund execution
  was visible. Watch item.
- **Payment Review Copilot** — PayPal-hackathon sandbox demo (GitHub
  `rishilifts/paypal-payment-review-copilot`); insufficient public detail
  to map lifecycle stages. Watch item.

## What AFTERPACT concedes

Pre-payment authorization is a solved-and-crowded space: Mandate,
Allowance, and IntentLock each do parts of it better than AFTERPACT needs
to. AFTERPACT complements those gates with the post-payment loop they
omit — and any buyer already running one of them is an integration
partner, not a lost deal.
