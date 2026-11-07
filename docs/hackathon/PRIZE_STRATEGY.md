# AFTERPACT — Prize Strategy

Constraint (rules §8): a project can win at most ONE Grand + ONE Sponsor, OR
ONE Honorable Mention + ONE Sponsor. Never assume multiple sponsor prizes.

Optimization order: 1st Overall (primary) → AG Grid 1st (primary sponsor) →
Channel3 / APIMatic / Bryntum / Render (secondary; each also a valid single
sponsor win) → Honorable Mentions (fallbacks). Every sponsor integration must
solve a recognizable user problem — never add one solely to claim it.

Status note (2026-11-07): nothing below is built yet. "Implementation"
describes the plan; "evidence" describes what must exist by submission.

## Grand — 1st Place Overall ($12,000) — PRIMARY

- Eligibility: any eligible submission passing the Stage One gate (fits theme,
  reasonably applies PayPal + AI).
- Implementation: the full AFTERPACT flagship scenario — Intent → Channel3
  discovery → structured Promise → approval → sandbox capture → labeled
  logistics incident → AI resolution proposal → operator approval → real
  sandbox refund → Flight Recorder replay + AG Studio dashboard regeneration.
  Plus the negative scenario (prompt-injection attempt blocked by the policy
  engine, rejection preserved in the recorder).
- Evidence: live demo (hosted URL, free until Dec 15, 2026) + public repo with
  OSS license + <3-min YouTube video showing end-to-end working + tests.
- Risks: scope creep across 5 days (deadline Nov 12); sandbox flakiness;
  video running long; repo/license checklist misses.
- Cost: highest — the whole build. Everything else hangs off this.
- Strengthens overall: IS the overall submission.
- Demo visibility: all 9 acts of the flagship scenario; video must label what
  is real (PayPal sandbox, AI inference, Channel3) vs simulated (logistics
  events) vs test data.

## Sponsor — AG Grid 1st ($5,000) — PRIMARY SPONSOR

- Eligibility: use AG Grid / AG Studio tools in an eligible submission.
- Implementation: Commerce Intelligence Studio — embedded AG Studio dashboards
  over AFTERPACT data (captures, refund rates, unresolved incidents, amounts
  at risk, recovery duration, incident categories, merchant performance,
  evidence completeness, SLA status) with custom widgets, theming,
  cross-filtering, and Studio Agent Framework natural-language commands that
  change/query real dashboard state (e.g. "show incidents with unresolved
  refunds above $100").
- Evidence: embedded dashboards in the app; NL commands demoed live; tests
  proving the dashboard is not a static mockup; free 45-day trial + official
  boilerplate (github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate).
- Risks: AG Studio learning curve; Agent Framework availability/limits;
  trial licensing in a public repo (do not redistribute licensed files
  improperly).
- Cost: high — second only to the core build.
- Strengthens overall: yes — analytics + "sponsor-powered intelligence" act
  directly serve Technological Implementation and Design criteria.
- Demo visibility: Act 9 — NL dashboard regeneration on the incident data.

## Sponsor — Channel3 ($1,500) — SECONDARY

- Eligibility: use Channel3 tools; must actually CALL the API or MCP server —
  mention-only does not qualify.
- Implementation: Engine B offer discovery — POST /v1/search (NL query,
  filters, ranked offers), /lookup for URL metadata; normalized product data,
  source attribution, ranking explanations, missing-data and failure
  handling. Keep discovery separate from the authorized sandbox payment path
  (a search result does not imply the merchant is chargeable on our sandbox
  credentials); demo routes to an explicitly authorized sandbox merchant
  offer. API key: no credit card; 20,000 free credits with promo
  PAYPAL-HACKATHON-2026 (use only if legitimately available).
- Evidence: real API responses in logs/Flight Recorder; source attribution in
  UI; graceful failure path demoed or tested.
- Risks: API availability/quota; data quality gaps; conflating discovery with
  checkout authorization.
- Cost: medium — one engine + normalization layer.
- Strengthens overall: yes — real discovery grounds Act 2 and the AI story.
- Demo visibility: Act 2 — live product candidates with sources shown.

## Sponsor — APIMatic ($1,000 + 6-mo Business sub) — SECONDARY

- Eligibility: use the PayPal API Context Plugin in the AI coding agent
  during development (3 winners).
- Implementation: install the Context Plugin (PayPal pre-enabled, no extra
  credentials) in the coding agent; use it to validate PayPal request shapes
  and prevent outdated-doc hallucinations throughout the build.
- Evidence: validated requests / schema corrections / integration decisions /
  error-handling improvements attributable to the plugin, recorded in
  docs/architecture (e.g. APIMATIC_EVIDENCE.md). Do NOT claim this prize if
  the plugin was not actually used.
- Risks: plugin/agent compatibility; thin evidence if used passively.
- Cost: low — workflow tooling + evidence notes.
- Strengthens overall: yes — API correctness improves reliability; no product
  surface cost.
- Demo visibility: none in the 3-min video (development-process prize);
  evidence lives in repo docs.

## Sponsor — Bryntum ($1,000) — SECONDARY

- Eligibility: real use of Gantt / Scheduler / Calendar (3 winners); free
  45-day trial.
- Implementation: Recovery Operations Timeline — expected delivery, evidence
  deadlines, merchant response windows, customer notifications, refund
  approval, settlement verification, escalation; an incident must alter
  schedule dependencies (dependency-aware rescheduling on incident detect /
  resolution propose).
- Evidence: timeline view in the app reacting to a real incident event; trial
  license handled per its terms.
- Risks: web-component integration effort in React; trial expiry vs judging
  window (demo must live until Dec 15 — confirm trial coverage).
- Cost: medium — one view + event wiring.
- Strengthens overall: moderately — visualizes the resolution workflow;
  cut first if the core slips (P1).
- Demo visibility: brief — timeline update on incident (inside Act 5/6) or
  omitted from video with repo evidence only.

## Sponsor — Render (credits: 1st $1K / 2nd $750 / 3rd $500) — SECONDARY

- Eligibility: deploy on Render; Render Workflows use strengthens the case.
- Implementation: host app/services on Render (deployment-as-code Blueprint);
  durable workflow tasks where justified: evidence analysis, payment
  reconciliation, incident evaluation, refund-status verification, resolution
  report generation — with real execution + dashboard observability.
- Evidence: live Render URL; workflow executions visible in Render dashboard;
  render.yaml in repo.
- Risks: free-tier sleep/limits vs "free and unrestricted until Dec 15"
  judging requirement; workflow SDK learning curve.
- Cost: medium — deploy config + workflow wiring.
- Strengthens overall: yes — hosted demo satisfies the functional-demo +
  availability requirements.
- Demo visibility: implicit — the demo IS the Render deployment; mention URL
  in video/repo.

## Honorable Mention fallbacks ($5,000 each; pick at most one path)

HM + one sponsor is the alternate route if Grand slips. Each HM below reuses
the same build with a different emphasis; no separate implementation.

- Best Use of PayPal + AI: eligibility — deepest PayPal/AI fusion.
  Implementation: the full lifecycle (Orders v2 + refunds + webhooks +
  structured validated AI at intent/verification/resolution). Evidence: real
  sandbox IDs in Flight Recorder. Demo: Acts 4–7. Cost: zero marginal.
- Best Use of Agentic Commerce: eligibility — agentic purchase flow.
  Implementation: intent → offer → promise → approval → payment → recovery
  agent loop with human gates. Demo: Acts 1–4 + 6. Cost: zero marginal.
- Most Impactful: eligibility — real problem, real audience. Implementation:
  merchant-ops persona, quantifiable recovery story (amounts at risk → verified
  refunds). Demo: problem framing + Act 7 numbers. Cost: pitch framing only.
- Most Creative: eligibility — novelty. Implementation: post-payment assurance
  + Flight Recorder replay (the tail competitors omit). Demo: Act 8 replay.
  Cost: zero marginal.
- Best Demo Delivery: eligibility — presentation quality. Implementation:
  sub-3-min video discipline, labeled real-vs-simulated, clean narration.
  Demo: the video itself. Cost: rehearsal time.

## Optimization summary

1. Build the Grand-1st core first (PayPal + AI + verification + refund +
   Flight Recorder + tests + repo/license + video).
2. Layer AG Grid Studio + Channel3 as the primary/secondary product sponsors
   (both strengthen the core narrative).
3. Use APIMatic Context Plugin from day one (free correctness evidence).
4. Add Render hosting early (demo availability is a hard requirement);
   Bryntum only after the core is green.
5. Keep HM fallbacks warm through pitch framing, not extra code.

Max credible combination: Grand 1st ($12K) + one sponsor (AG Grid 1st $5K) =
$17,000. Never plan on stacking sponsor prizes.
