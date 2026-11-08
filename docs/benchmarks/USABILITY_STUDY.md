# AFTERPACT usability study package (task-based, 30 min)

> Status: PACKAGE READY — no session has been run. No participants, no
> timings, no observations exist yet. Do not cite this file as user
> evidence until a real session is recorded in §6.

## 1. Protocol

- **Participant:** one person unfamiliar with the codebase, ideally with
  ops/support/e-commerce exposure. No coaching during tasks.
- **Environment:** hosted demo `https://199.247.9.188.nip.io` (mock
  transport) or local `npm run build && npm start`; facilitator resets
  via Demo view → reset before each scenario.
- **Method:** think-aloud; facilitator records timestamps per milestone,
  errors, confusions, and verbatim quotes. Screen-record with consent.
- **Timing protocol:** start the clock when the task prompt is read; stop
  at the completion criterion. Machine latency is negligible (see
  `IMPACT_BENCHMARK.md`) — measured time is human time.

## 2. The five scenarios

For each: ground truth (GT), manual workflow (M), AFTERPACT workflow (A),
completion (C), accuracy (AC), financial-error (FE) criteria.

### S1 — Partial delivery (flagship case)

- GT: 3 kits promised, 2 delivered; missing share = 1/3 of item total.
- M: ticket → PayPal dashboard → compare vs carrier note → hand-compute
  share → check remaining capture → manager chase → refund → spreadsheet.
- A: `#/demo` → Flagship → incident auto-detected → proposal → approve →
  Flight Recorder verify.
- C: participant states the refund amount and shows the provider refund id.
- AC: correct incident category + correct amount to the cent.
- FE: any proposed amount exceeding the missing share = fail.

### S2 — Duplicate payment concern

- GT: single order, single capture; buyer claims double charge (false alarm).
- M: search two dashboards, compare capture ids by hand, reply to buyer.
- A: `#/tx/:id` → one capture row, reconciliation status, export evidence.
- C: participant declares "single capture" with the capture id as proof.
- AC: no refund proposed; correct capture id cited.
- FE: any refund on a single-capture order = fail.

### S3 — Incorrect quantity

- GT: 5 units promised, 4 shipped; unit price known.
- M: same as S1 with quantity arithmetic.
- A: record outcome → gap detector → proposal → approve → verify.
- C: refund equals exactly 1 × unit price, verified at provider.
- AC: category + amount exact.
- FE: amount ≠ 1 unit, or refund before approval = fail.

### S4 — Missed delivery deadline

- GT: delivery date + tolerance window passed, no delivery outcome.
- M: calendar check → ticket → dashboard → policy lookup → escalate.
- A: Outcome Twin shows PROMISED date vs OBSERVED gap → incident →
  recovery proposal (replacement or refund per policy).
- C: participant names the violated obligation and the chosen recovery.
- AC: correct obligation (date + tolerance cited) + policy verdict read.
- FE: refund exceeding captured funds, or approval bypass = fail.

### S5 — Conflicting evidence requiring escalation

- GT: carrier note says "delivered", buyer outcome says "not received";
  confidence split — correct action is escalate, not refund.
- M: ops judgment call, usually a long thread.
- A: incident shows both evidence items with provenance + confidence;
  policy returns Hold; participant escalates instead of approving.
- C: participant escalates with both evidence ids cited, no refund issued.
- AC: both sources named; Hold verdict understood.
- FE: issuing a refund against conflicting evidence = fail.

## 3. Observation sheet (per participant, per scenario)

| Field | Value |
|---|---|
| Task completion (C met?) | yes / no / partial |
| Time to understand the view | mm:ss |
| Time to identify the incident | mm:ss |
| Time to verify the recommended action | mm:ss |
| Time to locate the refund proof | mm:ss |
| Confusing controls (which?) | — |
| Incorrect assumptions (quote) | — |
| Error count + recovery path | — |

## 4. Machine-verifiable comparisons (no humans needed)

Run per scenario: decision count (manual touchpoints vs assisted
decisions), hand computations (n vs 0), policy verdict correctness,
bounds enforcement (over-refund refused), audit export presence. This is
what CI-adjacent scripts can assert; human timings stay UNMEASURED until
§6 has rows.

## 5. Heuristic pre-review (expert, NOT user testing)

Author walkthrough 2026-11-08: every view states its purpose in the
header; primary actions are single buttons (Flagship, Approve, Export);
financial values carry currency + origin badges; loading/empty/error
states exist on all data views; keyboard + reduced-motion + focus styles
verified in code (`:focus-visible`, `prefers-reduced-motion`, live
regions). Open heuristic items: none blocking; confirm with §6 sessions.

## 6. Session log

| Date | Participant (role, no name) | Scenarios | Completed | Notes |
|---|---|---|---|---|
| — | none yet | — | — | Package prepared 2026-11-08; owner action: recruit 1+ participants |
