# AFTERPACT — Competitive Landscape

Hackathon context: "Build What's Next with PayPal and AI" on Devpost
(~30k participants, sandbox-only, deadline Nov 12, 2026). All entries below
are PayPal-hackathon submissions unless noted. Evidence basis per entry is
stated; snippet-only entries (Devpost bodies returned HTTP 403 to the fetcher)
are marked as such. No originality claims beyond the cited gaps.

Dominant pattern across 15+ submissions: "LLM proposes, deterministic code
decides, human approves, PayPal pays" — i.e. PRE-payment authorization
controls. AFTERPACT's post-payment assurance chain
(Intent → Offer → Promise → Approval → Payment → Verification → Exception →
Resolution → Verified Result) occupies the lifecycle tail most competitors
omit (Verification → Exception → Resolution → Verified Result).

## 1. Mandate (MuhammadNabiyev) — full GitHub README opened

- Problem: agents handed a card can ignore prompt spending limits.
- AI: Gemini or OpenAI-compatible model proposes cart from catalog + drafts
  mandate from plain English; pure unit-tested policy engine (policy.ts)
  returns Cleared/Hold/Refused; built-in non-AI matcher fallback.
- PayPal: Orders v2 create+capture, JS SDK approval, sandbox-only + local
  simulator; BYO sandbox keys. Server re-prices cart, re-runs policy
  pre-order; integer cents; model output validated vs catalog.
- Guardrails: per-purchase limit, rolling day/week/month budget, categories,
  blocked merchants, expiry, ask-first threshold; revoke/pause.
- Lifecycle: Intent → Offer → Promise(mandate) → Approval → Payment → ledger
  with order+capture ids. NO post-payment verification, exception, or
  resolution. Recovery: none beyond revoke.
- Sponsors: none visible beyond PayPal. Demo quality high: live Vercel demo
  no-signup, npm test suite, honest limitations section.
- AFTERPACT must do what Mandate punts: server-side signed mandate storage,
  webhook-driven capture verification, and post-payment dispute/exception
  handling.

## 2. Mandate (Chinorab) — substantial GitHub README opened

- Problem: who carries cost when an agent purchase is disputed (chargeback
  liability gap; cites Mastercard/Datos $36.9B 2026 chargeback cost).
- AI: Claude turns plain words into structured terms (budget, currency,
  category, attributes, stores, expiry, order count); buyer edits then signs;
  canonical JSON + SHA256 fingerprint + timestamp.
- PayPal: Vault (link once), Orders v2, Disputes API evidence, webhooks
  signature-verified; sandbox dispute walkthrough; AG Grid ledger;
  Agent Toolkit.
- Depth: deepest pre-payment consent gate + post-payment evidence file (signed
  mandate, fingerprint, term-by-term check, order, tracking, draft dispute
  response). Merchant-side and dispute-only: no independent verification of
  delivery/promise-kept, no buyer-side exception workflow.
- Demo: live Render demo to Dec 15, 2026, 2-min video, tests, env docs.
- AFTERPACT must differentiate: (a) buyer-side verified-result loop, not just
  merchant evidence pack; (b) promise-vs-delivery verification before disputes
  exist; (c) full Exception → Resolution state machine, not a draft response.

## 3. Leash — live site fully opened + Devpost snippets

- Problem: give an agent a PayPal wallet on a leash.
- AI: Groq gpt-oss-120b agent + Channel3 product search; deterministic
  mandate check.
- PayPal: Vault API setup → payment token (approve once), Orders API vault_id
  charge, Payouts API to retailer, Agent Toolkit create_refund. Covers charge
  AND retailer settlement AND refund path; ledger tape UX
  (SEARCH → PICK → CHECK → CHARGE → PAYOUT → Settled).
- Guardrails: mandate covers/never/ask-first-line/expiry; three refusal demos.
  Refund API wired but no policy around it; no verification/exception workflow.
- AFTERPACT must own the missing decision layer: WHEN a refund/exception is
  warranted (verification evidence) and the resolution workflow around it.

## 4. Allowance / AgentAllowance — substantial README opened + snippets

- Problem: small-team buying without handing AI the company card.
- AI: Gemini 3.5-flash function-calling loop (search_products, check_policy,
  place_order), Zod-validated tools, Claude Opus optional; second-opinion +
  human for big buys.
- PayPal: OAuth2, Vault v3 setup+payment tokens, Orders v2 with vault_id +
  idempotency (PayPal-Request-Id), webhooks PAYMENT.CAPTURE.* verified +
  deduped. "AI decides WHAT, code decides WHETHER." AG Grid ledger.
- Lifecycle ends at webhook-synced ledger (settlement truth): no
  promise-vs-delivery check, no exception/resolution flow, no recovery.
  Clear SMB wedge. Live Render demo + 3:20 video.
- AFTERPACT must complement, not clone: post-payment verification + exception
  queue + resolution evidence for the same SMB buyer.

## 5. AgentTab — NOT a PayPal entry (MongoDB SHACK15; LinkedIn partial)

- Problem: agent spending rules go stale when the seller changes the deal.
- AI/rails: rule-drift detection + human-in-loop rule update; HTTP 402
  price-on-door (Stripe/Tempo MPP rails) — NO PayPal.
- Lifecycle: Offer → Promise(rules) → Approval(re-consent); no payment
  verification or dispute stages.
- Closest conceptual cousin to AFTERPACT Verification → Exception, but on
  crypto rails and pre-payment. AFTERPACT must do the PayPal-native
  post-payment version: notice when DELIVERED reality differs from the
  PROMISED offer, and drive Exception → Resolution.

## 6. PayGuard AI (4 same-name variants; snippets only — bodies 403)

- Variants: (a) transaction risk analysis platform (Orders
  create/approve/verify/capture + explainable risk); (b) smart shopping
  assistant (price-anomaly check); (c) scam-message analyzer;
  (d) refund/dispute agents for small shops (over $25 waits for owner,
  idempotent no-double-refund, live sandbox).
- (a)(b) are pre-payment risk; (d) touches Exception → Resolution (refunds /
  disputes with approval gate + idempotency) but is a point tool (refund
  button + threshold).
- AFTERPACT must provide the full verified-result chain (evidence-backed
  verification, exception taxonomy, resolution tracking) that a refund button
  lacks.

## 7. AgentGuard (snippets; bodies 403)

- Variants: (a) spending firewall (plain-English rules, prompt-injection
  defence, one-tap approvals, AG Studio dashboard + anomaly-alert agent);
  (b) IntentLock: binds authorization to intended purchase details, backend
  re-checks PayPal order vs stored authorization BEFORE capture
  (TS backend, SQLite, sandbox).
- Lifecycle: Promise → Approval → Payment; IntentLock's capture-time binding
  is the strongest pre-settlement integrity check found — but still
  pre-settlement, not post-payment.
- AFTERPACT must extend the same binding idea post-settlement: bind
  DELIVERY/OUTCOME to the authorized intent and flag divergence.

## 8. Merchant-side guard cluster (snippets): Interlock, Fizzl Guard, PayLeash, Ledger Case

- Interlock: approval layer between agents and PayPal Agent Toolkit (gates 9
  write tools: refunds, invoice sends, dispute concessions); agent never holds
  credentials; cites PayPal Developer Agreement §1.3 liability.
- Fizzl Guard: pre-refund Disputes API check (stops refund if a chargeback
  already took the money — double-pay prevention proven in sandbox).
- PayLeash: plain-language → Ed25519-signed mandate, one-tap approval, kill
  switch, held-call provenance.
- Ledger Case: read-only AI detective + separate non-AI clerk refunding ≤$200
  once on human approval.
- This cluster owns merchant-side write-gating with exception DECISION support
  but no verification-of-delivery or resolution tracking.
- AFTERPACT must own the buyer-side assurance loop and the evidence model both
  sides can trust (verified result), interoperating with — not duplicating —
  these gates. Match Fizzl's dispute-before-refund double-pay guard.

## 9. Escrow/settlement cluster (snippets): AgentEscrow, AgentMarket AI, PayAgent AI, ProofPay, Skuuy

- Shared pattern: Orders v2 AUTHORIZE hold → AI/sentinel verifies deliverable
  → CAPTURE/VOID. AgentEscrow: 5-stage protocol, SentinelGuard AST/vuln/schema
  checks on code deliverables. AgentMarket AI: M2M SLA negotiation +
  micro-escrow + Gemini. PayAgent AI: $200/$500/$80 deterministic caps + AG
  Grid audit ledger. ProofPay: milestone escrow, AI checks work vs brief.
- Nearest lifecycle overlap with AFTERPACT but narrow: freelance/code
  deliverable escrow with AUTHORIZE holds — NOT general post-payment assurance
  for ordinary (captured, not held) PayPal purchases.
- AFTERPACT must handle the captured-payment world (verify after final
  payment, exceptions, refunds/disputes) where hold-and-void is unavailable —
  a strictly harder and broader problem.

## 10. Dispute-copilot cluster (snippets): Rebuttal, Truce, ProofFlow, Casebound, Dispute Copilot, FraudTrace, Trailhead

- Shared pattern: CUSTOMER.DISPUTE.CREATED webhook → gather order/tracking /
  policy evidence → AI-drafted rebuttal → Disputes API provide-evidence.
  Rebuttal: Gemini + Agent Toolkit autopilot, partial-refund option, evidence
  pack + PDF. Casebound: fight-vs-refund expected-value math, $6 auto-refund.
- Lifecycle: Exception → Resolution (merchant defence) only; no pre-dispute
  verification, no buyer-side workflow, no verified-result closure.
- AFTERPACT must shift left of disputes (verify delivery early, resolve
  exceptions before they become disputes) and close the loop buyer-side
  (verified result), where this cluster never goes.

## 11. Anticipated-not-observed names (evidence of absence)

Targeted + gallery searches found NO PayPal-hackathon submission for:

- "Agentic Cart" — resolves to Adyen Agentic suite + OpenAI ACP merchant
  plugins; industry terminology, not a rival entry.
- "TrustCart Agent" — only unrelated same-name projects (GPT-4 shopping-intel
  platform, Chrome review extension, 2019 smart-cart Devpost).
- "CartSplit AI" — nothing found anywhere (nearest: "Otu — buy as one"
  group-buy with Orders v2 + Gemini mandate).
- "PayPal Reconciliation Agent" (exact) — nearest neighbors: PayPal Operations
  Agent (dispute+invoice triage, human authorizes), PaidCheck (pasted "I paid
  you" claim → MATCHED verdict vs sandbox transactions — closest to AFTERPACT
  Verification stage but claim-checking only, no lifecycle), Checkout Agent
  (Gemini function-calling, verified sandbox captures).
- "SENTINEL" (single entry) — fragments only: PayAgent-Sentinel, PayPal
  Sentinel, Senior Sentinel, SentinelGuard, P2P Sentinel deck.

AFTERPACT should still pre-empt these spaces (group-buy splits, trust scoring,
reconciliation) via its ledger + verification core.

## AFTERPACT differentiation checklist (derived from the above)

1. Own Verification → Exception → Resolution → Verified Result: 90%+ of
   observed entries stop at Payment/ledger; escrow verifies only hold-phase
   code deliverables; dispute copilots start only at DISPUTE.CREATED.
2. Buyer-side + bilateral: competitors split buyer-pre-auth
   (Mandate/Leash/Allowance) vs merchant-defence (Rebuttal/Truce); AFTERPACT's
   Intent → Verified Result chain serves the buyer while producing
   merchant-credible evidence.
3. Captured-payment reality: design for post-capture verification (webhooks
   CAPTURE.COMPLETED/DENIED/REFUNDED, tracking, delivery proof).
4. Evidence integrity bar: match or exceed Chinorab-Mandate (SHA256
   canonical-JSON fingerprints, versioned signatures) and Fizzl
   (dispute-before-refund double-pay guard).
5. Demo-quality bar: live sandbox demo + video + tests + honest-limitations
   section (Mandate/Allowance/Leash standard).
6. Standard PayPal surface to cover: Orders v2, Vault, Payouts, Refunds,
   Disputes API, webhooks with signature verification, Agent Toolkit (gated),
   AG Grid ledger — every leader uses most of these.

## Evidence limitations

- Devpost submission bodies returned HTTP 403 for direct fetch for most
  entries; those rest on search snippets + gallery lines. Mitigated by fully
  opening 3 independent full bodies (2 GitHub READMEs, Leash live site)
  covering the closest competitors; only mandate-xuztcy Devpost page
  returned 200 (truncated).

## TITAN VI addendum (2026-11-09): OmegaCommerce — closest AG Grid rival

Source: project Devpost page fetched 200 on 2026-11-09
(`devpost.com/software/omegacommerce`, published 2026-10-23) + live
Vercel demo link + public GitHub repo link (repo body not opened).

- Problem: agents that can actually pay across two money rails.
- Product: Commerce MCP server (agent identity, x402 quotes/settlement,
  PayPal payouts, ledger) + fund-provenance dashboard in AG Grid/AG
  Studio showing every settlement on both rails (x402 USDC + PayPal).
- PayPal: sandbox invoices + payouts to real people (different API
  surface from AFTERPACT's Orders/capture/refund loop; both meaningful).
- AI: MCP surface agents call + "optional AG Studio AI" for the Studio
  assistant (custom-agent/tool depth not visible in seen evidence).
- Lifecycle: Intent → Quote → Payment → provenance Ledger. NO
  post-payment promise/outcome verification, exception workflow,
  recovery planning, or refund execution described — same lifecycle
  tail gap as the rest of the observed field.
- AFTERPACT differentiation vs OmegaCommerce (cited gaps only):
  (a) assurance tail (verification → exception → resolution → verified
  result) vs settlement ledger; (b) custom Studio agent
  (`outcome-risk-analyst`) + 3 tested read-only custom tools vs
  "optional Studio AI" of unknown depth; (c) buyer-side verified-result
  loop vs agent-payment rails. No claim about their demo quality,
  which the seen evidence shows as live and credible.
- LinkedIn article bodies truncated by auth wall; corroborated by independent
  snippets.
- No observed submission states sponsors beyond PayPal/Channel3/AG Grid tech
  usage or a business model beyond SMB value-props; marked absent, not
  inferred.
