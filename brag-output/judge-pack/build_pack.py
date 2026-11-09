"""Build AFTERPACT_JUDGE_EVIDENCE_PACK.zip — 6 PDFs + evidence/ folder.

Usage: python build_pack.py
Output: AFTERPACT_JUDGE_EVIDENCE_PACK.zip (same dir), must stay <= 35 MB.

Content is curated from repo sources (see SOURCES below); numbers match
docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json + docs/evals/* + VIDEO_QA_REPORT.
Requires: pip install reportlab
"""
import html
import pathlib
import shutil
import subprocess
import zipfile

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (ListFlowable, ListItem, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

BASE = pathlib.Path(__file__).parent
ROOT = BASE.parent.parent  # repo root (brag-output/judge-pack -> repo)
OUT = BASE / "pack"

TEAL = colors.HexColor("#0E7C6B")
DARK = colors.HexColor("#101418")
GREY = colors.HexColor("#5B6470")
LIGHT = colors.HexColor("#F2F5F7")

STYLES = getSampleStyleSheet()
S_TITLE = ParagraphStyle("t", parent=STYLES["Title"], fontSize=22, leading=26,
                         textColor=DARK, spaceAfter=2 * mm)
S_SUB = ParagraphStyle("s", parent=STYLES["Normal"], fontSize=10, leading=13,
                       textColor=GREY, spaceAfter=6 * mm)
S_H1 = ParagraphStyle("h1", parent=STYLES["Heading1"], fontSize=14, leading=17,
                      textColor=TEAL, spaceBefore=6 * mm, spaceAfter=3 * mm,
                      keepWithNext=True)
S_H2 = ParagraphStyle("h2", parent=STYLES["Heading2"], fontSize=11, leading=14,
                      textColor=DARK, spaceBefore=4 * mm, spaceAfter=2 * mm,
                      keepWithNext=True)
S_P = ParagraphStyle("p", parent=STYLES["Normal"], fontSize=9.5, leading=13.5,
                     spaceAfter=2 * mm)
S_CODE = ParagraphStyle("c", parent=STYLES["Code"], fontSize=8, leading=10.5,
                        backColor=LIGHT, borderPadding=3, spaceAfter=3 * mm,
                        fontName="Courier")
S_CAP = ParagraphStyle("cap", parent=STYLES["Normal"], fontSize=8, leading=10,
                       textColor=GREY, spaceAfter=3 * mm)
S_CELL = ParagraphStyle("cell", parent=STYLES["Normal"], fontSize=8.5, leading=11)
S_CELL_H = ParagraphStyle("cellh", parent=S_CELL, textColor=colors.white,
                          fontName="Helvetica-Bold")

TABLE_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), TEAL),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("LEADING", (0, 0), (-1, -1), 11),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D2D8")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
])


def esc(t):
    return html.escape(t, quote=False)


def render_block(story, block):
    kind = block[0]
    if kind == "p":
        story.append(Paragraph(esc(block[1]), S_P))
    elif kind == "h1":
        story.append(Paragraph(esc(block[1]), S_H1))
    elif kind == "h2":
        story.append(Paragraph(esc(block[1]), S_H2))
    elif kind == "bullets":
        items = [ListItem(Paragraph(esc(x), S_P), leftIndent=6 * mm) for x in block[1]]
        story.append(ListFlowable(items, bulletType="bullet", leftIndent=6 * mm,
                                  bulletFontSize=9, spaceAfter=3 * mm))
    elif kind == "code":
        story.append(Paragraph(esc(block[1]).replace("\n", "<br/>"), S_CODE))
    elif kind == "table":
        head, rows = block[1], block[2]
        widths = block[3] if len(block) > 3 else None
        data = [[Paragraph(f"<b>{esc(c)}</b>", S_CELL_H) for c in head]]
        data += [[Paragraph(esc(c), S_CELL) for c in r] for r in rows]
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TABLE_STYLE)
        story.append(t)
        story.append(Spacer(1, 3 * mm))
    elif kind == "caption":
        story.append(Paragraph(esc(block[1]), S_CAP))


def build_pdf(filename, title, subtitle, blocks):
    path = OUT / filename
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=18 * mm,
                            rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=16 * mm, title=title,
                            author="AFTERPACT")
    story = [Paragraph(esc(title), S_TITLE),
             Paragraph(esc(subtitle), S_SUB)]
    for b in blocks:
        render_block(story, b)
    doc.build(story)
    return path


HDR = ("AFTERPACT — PayPal AI Hackathon 2026 · Judge Evidence Pack · "
       "2026-11-09 · commit a2be8424 · Repo: github.com/toskaman/afterpact · "
       "Demo: https://199.247.9.188.nip.io")


DOC00 = [
    ("p", "AFTERPACT is the assurance layer for agentic commerce. AI agents can "
     "already buy anything — but a successful payment is not a successful purchase. "
     "When delivery goes wrong there is no machine-verifiable record of what was "
     "promised, no bound on what the agent may concede, and no auditable recovery. "
     "AFTERPACT closes that gap: every purchase becomes a structured promise, every "
     "promise is verified against observed outcomes, and every failure is recovered "
     "with evidence-backed AI proposals, deterministic policy gates, human approval, "
     "and provider-confirmed refunds."),
    ("h1", "The problem"),
    ("bullets", [
        "Agentic checkout exists, but post-payment accountability does not: short "
        "deliveries, substitutions, and over-charges surface as support tickets, "
        "spreadsheets, and manual PayPal dashboard work.",
        "Unbounded agents are dangerous near money: without approval binding and "
        "refund bounds, an agent can concede any amount to any merchant.",
        "Merchants lack a dispute-ready artifact: what was promised, what happened, "
        "who approved what, and what the provider confirmed — in one verifiable chain.",
    ]),
    ("h1", "The solution"),
    ("bullets", [
        "PurchasePromise: a versioned, hash-chained commercial commitment (exact "
        "items, amount, merchant, terms). Buyer approval binds to version + hash.",
        "PayPal Orders v2 execution: order, buyer approval, capture, partial/full "
        "refund, webhooks, reconciliation — sandbox-verified, live disabled in code.",
        "Outcome verification: observed outcomes are compared to the promise; "
        "mismatches raise categorized, severity-scored incidents.",
        "Recovery loop: AI proposes (evidence-cited), deterministic policy gates, "
        "a human approves, the provider executes, the Flight Recorder proves it.",
        "Commerce Intelligence Studio: AG Grid Community tables + licensed AG Studio "
        "canvas over the same live data, with an AI risk analyst.",
    ]),
    ("h1", "Value proposition"),
    ("bullets", [
        "For merchant operations: exception handling drops from an 8-touchpoint "
        "manual scramble to 3 supervised decisions, each with a verifiable artifact.",
        "For buyers: every AI purchase carries a machine-checkable receipt of what "
        "was promised vs what arrived vs what was recovered.",
        "For developers: one control plane for promise, payment, verification, "
        "recovery, and audit — instead of glue code across dashboards.",
    ]),
    ("h1", "Architecture at a glance"),
    ("p", "Single-process TypeScript app: a zero-dependency Node HTTP API serving a "
     "static single-page UI (9 views). Money is exact (integer minor units). Every "
     "financial move passes a deterministic policy gate and lands in an append-only "
     "hash-chained audit log. Full detail: 01_ARCHITECTURE.pdf."),
    ("table",
     ["Layer", "What it does", "Key guarantee"],
     [["apps/web (static SPA)", "Command, Copilot, Twin, Recovery, Recorder, Studio, Timeline, Developer, Demo/Judge views",
       "Every figure carries an origin pill (SIMULATED / REAL API / RECORDED)"],
      ["apps/api (node:http)", "REST routes + orchestration + demo scenarios + studio datasets",
       "Demo drives the same Ops methods as the routes — no parallel fake backend"],
      ["packages/domain", "Money, promise, approval, lifecycle, audit chain",
       "Exact arithmetic; approval bound to promise version + hash"],
      ["packages/policy", "Refund evaluation: Cleared / Hold / Refused",
       "Deterministic: same input, same verdict, forever"],
      ["packages/payments", "PayPal client: OAuth, orders, capture, refund, webhooks, reconcile",
       "Idempotent, mutex-serialized, kill-switched, sandbox-only by default"],
      ["packages/ai", "Vultr inference provider + structured tasks + deterministic fallback",
       "AI proposes only; identity-verified model; fail-closed fallback"]]),
    ("h1", "Verify it yourself in 60 seconds"),
    ("bullets", [
        "Open the demo Judge Mode and click 'Run the flagship scenario': 9 acts, "
        "intent to verified refund, then replay in the Flight Recorder.",
        "Card 4 (Provider-verified proof) cites two recorded PayPal Sandbox loops "
        "with real order/capture/refund ids — see 02_PAYPAL_EVIDENCE.pdf.",
        "Run the injection scenario: merchant-swap and amount-increase attempts are "
        "both REFUSED with exact policy reasons.",
        "Every claim in this pack maps to a file in evidence/ or a repo path — "
        "see 05_DEMO_GUIDE.pdf for the full reproduction script.",
    ]),
    ("caption", "Sources: README.md · docs/competition/WHY_AFTERPACT_IS_DIFFERENT.md · "
     "docs/business/WHY_A_MERCHANT_WOULD_PAY.md · docs/demo/JUDGE_MODE_GUIDE.md"),
]

DOC01 = [
    ("p", "AFTERPACT is a single-process TypeScript application: a zero-dependency "
     "Node HTTP API (no framework) serving a static single-page UI. There is one "
     "orchestration layer (Ops) shared by the REST routes and the demo scenarios, "
     "so the demo literally cannot drift from the product. Persistence is a "
     "single-node JSON snapshot store; the audit trail is an append-only "
     "hash-chained log verified by verifyAudit()."),
    ("h1", "Component map"),
    ("table",
     ["Component", "Path", "Responsibility"],
     [["Web UI (9 views)", "apps/web/public",
       "Command, Purchase Copilot, Transactions, Outcome Twin, Recovery, Flight "
       "Recorder, Intelligence Studio, Recovery Timeline, Developer, Demo/Judge"],
      ["Routes", "apps/api/src/routes.ts", "REST + static serving + operator gates"],
      ["Ops", "apps/api/src/ops.ts", "Orchestration: promises, approvals, incidents, resolutions"],
      ["Demo", "apps/api/src/demo.ts", "Flagship / hold / injection scenarios over Ops"],
      ["Studio", "apps/api/src/studio.ts", "Live datasets + strict natural-language ops"],
      ["Timeline", "apps/api/src/timeline.ts", "Dependency-aware rescheduling"],
      ["Discovery", "apps/api/src/channel3.ts", "Channel3 product search client (503 fail-closed)"],
      ["Domain", "packages/domain", "Money (minor units), promise, approval, lifecycle, audit chain"],
      ["Policy", "packages/policy", "Refund evaluation: Cleared / Hold / Refused"],
      ["Payments", "packages/payments", "PayPal transport, service, webhooks, reconcile, redact"],
      ["AI", "packages/ai", "Provider abstraction, structured tasks, fallback"]]),
    ("h1", "Flagship request flow"),
    ("code", "POST /api/demo/run {\"scenario\":\"flagship\"}  (or UI #/demo)\n"
     "  1. Intent -> catalog offer -> PurchasePromise (versioned, hashed)\n"
     "  2. Buyer approval bound to version + hash (expiry enforced)\n"
     "  3. PayPal order -> buyer approval -> capture (mock or live sandbox)\n"
     "  4. Outcome events -> mismatch detection -> incident (category+severity)\n"
     "  5. AI recovery proposal -> policy gate -> operator approval -> refund\n"
     "  6. Provider verification -> RESOLUTION_VERIFIED\n"
     "  Every step appends to the hash-chained audit log; judges replay it\n"
     "  in #/recorder and export a redacted JSON bundle."),
    ("h1", "Data flow and trust boundaries"),
    ("bullets", [
        "UI <-> API: JSON only; every figure the UI shows carries an origin badge "
        "(SIMULATED / REAL API / RECORDED) so mock data can never pose as live.",
        "AI boundary: model outputs are Zod-validated proposals only (packages/ai "
        "+ domain/ai). Policy decides, a human approves, payments executes. A test "
        "fails the build if provider-capable imports appear in the AI tool surface.",
        "Money boundary: all amounts are integer minor units; capture/refund bounds "
        "are enforced both locally (validateRefundBounds) and at the provider.",
        "Live-money boundary: live PayPal needs PAYPAL_MODE=live AND "
        "PAYPAL_ALLOW_LIVE=true, otherwise PayPalLiveDisabledError. Sandbox only "
        "in every demo and test.",
        "Kill switch: PAYPAL_KILL_SWITCH refuses new mutating ops; reads, webhooks, "
        "and reconciliation stay open (they only move local state toward provider truth).",
        "Secrets: none in the repo or on the demo box; status endpoints expose "
        "presence booleans only; every audit payload and log line passes fail-closed "
        "redaction (tests assert secrets never appear).",
    ]),
    ("h1", "Deployment"),
    ("bullets", [
        "Hosted demo: Vultr VPS at https://199.247.9.188.nip.io (mock transport, "
        "no secrets, run cap + token-gated reset), live through Dec 15, 2026.",
        "CI (.github/workflows/ci.yml): install -> typecheck (6 projects) -> 319 "
        "tests -> build -> vendor check -> compiled-server smoke (health, flagship, "
        "vendor bundles) -> Playwright E2E (15/15) -> docs-drift gate.",
        "Postman collection mirrors the same routes; Newman report: 37/37 requests, "
        "18/18 assertions (evidence/postman/).",
    ]),
    ("caption", "Sources: docs/architecture/ARCHITECTURE.md · docs/payments/PAYPAL_INTEGRATION.md · "
     ".github/workflows/ci.yml · evidence/RELEASE_EVIDENCE_MANIFEST.json"),
]

DOC02 = [
    ("p", "PayPal is the financial execution backbone of AFTERPACT: Orders v2 "
     "checkout, captures, partial/full refunds, webhook verification, and provider "
     "reconciliation (packages/payments). Two complete sandbox loops were executed "
     "with real API calls and are committed as redacted receipt artifacts. The "
     "hosted demo runs a deterministic mock transport that is always labeled — "
     "it never poses as live."),
    ("h1", "Recorded sandbox loop 1 — partial refund (flagship evidence)"),
    ("table",
     ["Step", "Sandbox id", "Status", "Amount"],
     [["Order", "2ER387580K033722V", "COMPLETED", "$389.97 USD"],
      ["Capture", "7R158417X9367771B", "PARTIALLY_REFUNDED", "$389.97 USD"],
      ["Refund (partial)", "8DJ895035B173303G", "COMPLETED", "$129.99 USD"]]),
    ("caption", "Provider: api-m.sandbox.paypal.com · Fetched 2026-11-08 · "
     "Artifact: evidence/paypal-live-receipts.json · Credentials redacted."),
    ("h1", "Recorded sandbox loop 2 — full refund"),
    ("table",
     ["Step", "Sandbox id", "Status", "Amount"],
     [["Order", "59A94150344824111", "COMPLETED", "$5.00 USD"],
      ["Capture", "72S38593LS000452A", "REFUNDED", "$5.00 USD"],
      ["Refund (full)", "15T12360RX6158212", "COMPLETED", "$5.00 USD"]]),
    ("caption", "Provider: api-m.sandbox.paypal.com · Fetched 2026-11-08 · "
     "Artifact: evidence/paypal-live-receipts-2.json · Credentials redacted."),
    ("h1", "How the integration works"),
    ("bullets", [
        "Create order returns providerOrderId + buyer approveUrl; the local order id "
        "travels as custom_id so captures link back on webhooks.",
        "Buyer approval at PayPal fires CHECKOUT.ORDER.APPROVED, moving the local "
        "order created -> approved (or poll getOrderStatus with refresh).",
        "Capture requires an approved local order plus a domain buyer Approval bound "
        "to the exact promise version + hash; expiry is enforced.",
        "Refunds are partial (explicit amount) or full (amount omitted = remaining "
        "balance). Domain bounds + policy gate every request; lifetime refunds can "
        "never exceed the captured total.",
        "Status reads accept {refresh: true} to re-read the provider and move local "
        "records forward; reconciliation repairs local state forward-only toward "
        "provider truth (currency drift is reported, never auto-repaired).",
    ]),
    ("h1", "Safety properties (all covered by tests)"),
    ("bullets", [
        "Idempotency: every mutating call takes a key sent as PayPal-Request-Id. "
        "Same key + same payload replays the stored result; same key + different "
        "payload raises PayPalReplayError.",
        "Concurrency: each op runs inside a per-record async mutex; racing callers "
        "serialize; failed provider calls leave failed-operation traces and no "
        "partial records.",
        "Webhooks: transmission headers required -> signature verified (PayPal "
        "verify-webhook-signature API; HMAC on the mock) -> dedupe on transmission "
        "id -> routed update. Unknown events are recorded and ignored; replays with "
        "a different body raise PayPalWebhookReplayError.",
        "Kill switch refuses new mutating ops; reads/webhooks/reconciliation stay open.",
        "AI boundary: agents only get proposeOrderCreation / proposeCapture / "
        "proposeRefund (strict Zod, executesProviderCall: false). The module imports "
        "only zod + domain; a build-failing test blocks provider-capable imports.",
        "Negative coverage: currency mismatch, expired approval, over-refund (local "
        "+ provider bound), duplicate/replayed/tampered webhooks, kill-switch "
        "refusal, provider-failure atomicity, concurrent same-key ops, HTTP "
        "429/422/timeout mapping, OAuth token caching.",
    ]),
    ("h1", "Re-verify it yourself"),
    ("bullets", [
        "Receipts are asserted by tests/integration/paypal.receipts.test.ts against "
        "the committed artifacts (ids, statuses, amounts).",
        "A live sandbox probe (create + read one $1 order, abandoned before "
        "approval) runs in CI only when PAYPAL_CLIENT_ID/SECRET are set, else skips "
        "cleanly — no live-money path exists in code.",
        "On the demo, Judge Mode card 4 cites both loops read-only; the transport "
        "pill shows MOCK / SIMULATED whenever the mock is active.",
    ]),
    ("caption", "Sources: docs/payments/PAYPAL_INTEGRATION.md · "
     "evidence/paypal-live-receipts.json · evidence/paypal-live-receipts-2.json · "
     "tests/integration/paypal.*.test.ts"),
]

DOC03 = [
    ("p", "Every number below comes from committed, re-runnable artifacts — no "
     "hand-waved percentages. Canonical counts live in "
     "evidence/RELEASE_EVIDENCE_MANIFEST.json (verified commit a4472481, CI run "
     "42680164068) and the drift gate fails the build if any governed doc "
     "contradicts them."),
    ("h1", "Automated suite"),
    ("table",
     ["Suite", "Result", "Notes"],
     [["Unit + integration (vitest)", "319 passed / 0 failed / 33 skipped",
       "36 files; skips are credential-gated live probes, transparent in output"],
      ["Typecheck", "6/6 projects", "domain, policy, payments, ai, api, tests"],
      ["Playwright E2E", "15/15", "dashboard, gallery, judge, studio, tour, twin"],
      ["Newman (Postman)", "37/37 requests, 18/18 assertions",
       "evidence/postman/newman-report.json"],
      ["Docs-drift gate", "PASS", "Manifest statics, stale-pattern, wording, lineage"]]),
    ("h1", "Payment chaos campaign (9 seeded scenarios, ~1 s)"),
    ("table",
     ["#", "Scenario", "Proven invariant"],
     [["1", "25 sequential same-key captures", "1 provider call, 24 replays, 1 capture"],
      ["2", "20 parallel same-key captures", "Exactly 1 winner, 1 provider call"],
      ["3", "2 racing 2000c refunds on 2500c capture", "1 wins, 1 RefundBoundsError, total 2000c"],
      ["4", "Drain 1000c + 1500c, then 1c", "Exact drain; final cent refused"],
      ["5", "500 on capture", "Retryable error, zero partial state, retry settles"],
      ["6", "429 on refund", "failed marker journaled (consumes no bounds), retry settles"],
      ["7", "504 on create, same-key retry", "Single order, no duplicate"],
      ["8", "Refund webhook before capture exists", "Ignored, no crash; links once capture lands"],
      ["9", "Approval webhook x5 redeliveries", "Applied once, 4 duplicates, 1 audit entry"]]),
    ("caption", "Suite: tests/integration/paypal.chaos.test.ts · No crash-recovery "
     "scenario is claimed (restart-during-pending-refund NOT covered)."),
    ("h1", "AI evaluations — 117/120 across 4 keyed runs"),
    ("p", "Model: deepseek-v4.1-flash-1017 via vultr-inference (identity verified per "
     "call). Corpus: 53 scenarios (30 live-eligible, 23 offline-only). Reports: "
     "evidence/evals/report-*.json (4 live runs, 2026-11-08)."),
    ("table",
     ["Run (UTC)", "Scenarios", "Model OK", "Schema fails", "Citation P", "Cost"],
     [["01:04", "28/30", "29/30", "1", "1.000 (12/0)", "$0.014"],
      ["01:06", "29/30", "28/30", "2", "1.000 (12/0)", "$0.013"],
      ["01:08", "30/30", "30/30", "0", "1.000 (12/0)", "$0.013"],
      ["11:39", "30/30", "30/30", "0", "1.000 (12/0)", "$0.009"],
      ["Total", "117/120", "117/120", "3", "1.000 (48/0)", "$0.048"]]),
    ("bullets", [
        "Reading note: scenario pass (ground-truth incl. safety gates) and "
        "model-call success (valid structured output) share a total here but mean "
        "different things — a run can pass via safe fallback while a call fails.",
        "Citation precision 1.000 = every emitted citation kept against the evidence "
        "allowlist (48 kept, 0 dropped). Recall is NOT measured — not claimed.",
        "Suite-version caveat: runs 1-2 predate a relaxation of three incident "
        "expectations; only run 4 (30/30) reflects the current suite.",
        "The 3 failures were root-caused, not redefined: a transient currency flake "
        "(prompt rule predates runs), unparseable-bytes fallback (fixed diagnosability "
        "via outputHead + regression tests), and a lone-string schema tic (fixed via "
        "looseStringArray coercion + regression tests). Re-run: 30/30, no fallback. "
        "Full analysis: evidence/evals/FAILURE_ANALYSIS.md.",
    ]),
    ("h1", "AI vs deterministic baseline — 59/60 vs 12/15"),
    ("p", "Shared set: 15 live intent scenarios, identical scorer. AI arm: the 4 "
     "committed recorded runs. Baseline arm: deterministic heuristic parser, re-run "
     "locally, zero inference spend. The heuristic fails quantity extraction on "
     "spelled-out numbers, large quantities, and EUR contexts; AI passes 59/60 at "
     "$0.0147 total, mean latency 2199 ms. Detail: "
     "evidence/evals/BASELINE_COMPARISON.md."),
    ("h1", "Concurrency probe — 25/25, chain VALID"),
    ("p", "25 concurrent flagship POSTs against a local build: 25/25 completed, 25 "
     "unique ids, 117 ms wall, p50/p95 78/107 ms, audit chain VALID at 300 entries, "
     "no cross-run interference. Honest scope: a local burst probe, not a production "
     "load test; it is now a durable CI test (tests/integration/demo.concurrency.test.ts)."),
    ("caption", "Sources: evidence/RELEASE_EVIDENCE_MANIFEST.json · docs/evals/* · "
     "docs/payments/CHAOS_CAMPAIGN.md · docs/security/SESSION_ISOLATION_REPORT.md"),
]

DOC04 = [
    ("p", "AFTERPACT's trust model is simple: the AI proposes, deterministic code "
     "disposes, a human approves, and the provider confirms. Every layer below is "
     "enforced in code and covered by tests — including the documented limits, "
     "which are stated here rather than hidden."),
    ("h1", "Deterministic policy gate"),
    ("bullets", [
        "Every refund proposal is evaluated by packages/policy to one of Cleared / "
        "Hold / Refused. Same input, same verdict, forever — no model in the loop.",
        "Bounds are checked twice: domain validateRefundBounds (per-capture "
        "remaining, lifetime cap) and the policy verdict. Lifetime refunds can never "
        "exceed the captured total (chaos scenarios 3-4 prove the edges).",
        "Buyer approval binds to the exact promise version + hash with expiry "
        "(assertApprovalUsable); stale or mismatched approvals refuse loudly.",
        "Injection scenario (judge-reproducible): merchant-swap and amount-increase "
        "attempts are both REFUSED with exact reasons, preserved as policy.blocked "
        "entries in the Flight Recorder.",
    ]),
    ("h1", "Webhook validation and reconciliation"),
    ("bullets", [
        "Transmission headers required -> signature verified via PayPal's "
        "verify-webhook-signature API (HMAC on the mock) -> dedupe on transmission "
        "id -> routed state update.",
        "Same body redelivered = duplicate (applied once, chaos scenario 9); "
        "different body on a known transmission id = PayPalWebhookReplayError; "
        "tampered signature rejected; unknown event types recorded and ignored.",
        "Out-of-order delivery is safe: a refund webhook arriving before its capture "
        "is ignored without crashing and links once the capture lands (scenario 8).",
        "Reconciliation diffs local vs provider and repairs forward-only toward "
        "provider truth; currency drift is reported, never auto-repaired.",
    ]),
    ("h1", "Idempotence and concurrency"),
    ("bullets", [
        "Every mutating call carries an idempotency key sent as PayPal-Request-Id; "
        "stored results replay with duplicate: true; key+payload mismatches raise "
        "PayPalReplayError.",
        "Per-record async mutexes serialize racing callers; record + operation + "
        "audit updates land atomically. Failed attempts journal failed markers that "
        "consume no bounds, so retries are never starved by their own history.",
        "25-way concurrent flagship burst: 25/25 completed, unique ids, chain VALID "
        "(durable CI test).",
    ]),
    ("h1", "Flight Recorder — the artifact merchants keep"),
    ("bullets", [
        "Append-only hash-chained audit log over every state transition "
        "(promise, approval, payment, incident, proposal, decision, refund, "
        "verification). verifyAudit() re-checks the whole chain.",
        "Replayable in #/recorder (step through each event) and exportable as a "
        "redacted JSON bundle — the dispute-ready record.",
        "All payloads pass fail-closed redaction; tests assert secrets never appear "
        "in entries or structured logs.",
    ]),
    ("h1", "Demo isolation and known limits"),
    ("bullets", [
        "Demo runs are anonymous; resetting a run needs its per-run token (browser "
        "only); global reset needs the operator token. Run cap bounds state growth.",
        "KNOWN LIMIT: global run/audit lists are shared — visitors can see each "
        "other's runs but cannot reset them without tokens. Full per-session "
        "isolation was deliberately deferred as too invasive pre-deadline; NO "
        "tenant-isolation claim is made anywhere (the drift gate fails the build on "
        "such wording).",
        "Single-node JSON snapshot store (atomic writes + .bak): safe for "
        "judge-scale traffic, not enterprise-scale; restart-during-pending-refund is "
        "NOT covered by tests and NOT claimed.",
        "No rate-limit numbers are quoted (not re-measured); abuse boundaries are "
        "the run cap + token gates + operator kill switch.",
    ]),
    ("caption", "Sources: docs/payments/PAYPAL_INTEGRATION.md · "
     "docs/payments/CHAOS_CAMPAIGN.md · docs/security/SESSION_ISOLATION_REPORT.md"),
]

DOC05 = [
    ("p", "Everything a judge needs to reproduce AFTERPACT end to end — no account, "
     "no keys, no setup. Public demo: https://199.247.9.188.nip.io (mock transport, "
     "labeled; live through Dec 15, 2026). Local repro: npm ci && npm run build "
     "&& npm start, then open http://localhost:3100."),
    ("h1", "The 30-second path (Judge Mode)"),
    ("bullets", [
        "Open #/judge. Headline: 'A successful payment is not a successful purchase.'",
        "Click 'Run the flagship scenario'. Watch Acts 1-9: intent -> discovery -> "
        "approval -> payment -> incident -> resolution -> verified recovery -> "
        "flight recorder -> studio.",
        "Follow 'Open in Outcome Twin' and 'Replay in Flight Recorder'. Every act "
        "carries an origin pill (SIMULATED / REAL API / RECORDED).",
    ]),
    ("h1", "The four scenario cards"),
    ("table",
     ["Card", "What it runs", "What it proves"],
     [["1 - Recover", "flagship: 3 kits promised, 2 delivered, bounded partial refund",
       "The full outcome loop incl. approval + verified recovery"],
      ["2 - Hold", "hold: promise with NO approval; policy Holds, order refused",
       "Restraint is real: no order record, nothing charged"],
      ["3 - Refuse", "injection: merchant-swap + amount-increase attempts",
       "Deterministic policy REFUSES both; evidence in policy.blocked"],
      ["4 - Proof", "Read-only: two recorded PayPal Sandbox loops",
       "Real provider execution happened and is inspectable"]]),
    ("h1", "The nine acts in detail"),
    ("table",
     ["Act", "Stage", "What to look for"],
     [["1", "Intent", "NL request becomes a structured goal (parse method labeled)"],
      ["2", "Discovery", "Live Channel3 candidates when keyed; labeled catalog fallback "
       "otherwise. Discovery never authorizes checkout."],
      ["3", "Approval", "Exact transaction approved: version, hash, amount"],
      ["4", "Payment", "PayPal order + capture (real approval URL when keyed; labeled "
       "simulated buyer on the hosted demo)"],
      ["5", "Incident", "Short delivery observed; gap detector raises a categorized, "
       "severity-scored incident"],
      ["6", "Proposal", "$129.99 partial refund proposed, validated against capture "
       "bounds, awaiting a human decision"],
      ["7", "Recovery", "Approval executes a provider refund; case closes "
       "RESOLUTION_VERIFIED with the provider refund id"],
      ["8", "Recorder", "Hash-chained, replayable, exportable — download the redacted JSON"],
      ["9", "Studio", "Analytics regenerate from the same live data; NL command + "
       "cross-filter over real rows"]]),
    ("h1", "API reproduction (curl)"),
    ("code", "BASE=https://199.247.9.188.nip.io\n"
     "# health + flagship\n"
     "curl -s $BASE/api/health\n"
     "curl -s -X POST $BASE/api/demo/run \\\n"
     "  -H 'content-type: application/json' \\\n"
     "  -d '{\"scenario\":\"flagship\",\"label\":\"judge-repro\"}'\n"
     "# restraint + refusal paths\n"
     "curl -s -X POST $BASE/api/demo/run \\\n"
     "  -H 'content-type: application/json' -d '{\"scenario\":\"hold\"}'\n"
     "curl -s -X POST $BASE/api/demo/run \\\n"
     "  -H 'content-type: application/json' -d '{\"scenario\":\"injection\"}'"),
    ("h1", "Q&A cheat sheet"),
    ("bullets", [
        "'Is PayPal real?' — Yes when keyed (sandbox ids on screen); the mock "
        "transport is deterministic and always labeled. Live mode is disabled in code.",
        "'Where is the AI?' — Real inference (Vultr, identity-verified) for intent, "
        "incidents, recovery, and the Studio agent, each badged and cost-accounted; "
        "deterministic gates stay authoritative and fallbacks hold when unkeyed. The "
        "hosted box shows authentic RECORDED VERIFIED AI RUNS — replay, never fake live.",
        "'Channel3 without a key?' — Unconfigured state, HTTP 503, zero fabricated "
        "rows. Set the key and the same UI goes live.",
        "'AG Studio?' — Canvas + Agent Framework genuinely integrated; trial key "
        "installed (LICENSED); written consent reply pending, Community fallback armed.",
    ]),
    ("caption", "Sources: docs/demo/JUDGE_MODE_GUIDE.md · docs/demo/DEMO_SCRIPT.md · "
     "docs/demo/FRONTEND_DEMO_GUIDE.md · evidence/screenshots/judge-mode.png"),
]

DOCS = [
    ("00_EXECUTIVE_BRIEF.pdf", "Executive Brief — problem, solution, value, architecture", DOC00),
    ("01_ARCHITECTURE.pdf", "Architecture — components, flows, trust boundaries", DOC01),
    ("02_PAYPAL_EVIDENCE.pdf", "PayPal Evidence — sandbox loops, integration, safety", DOC02),
    ("03_TEST_RESULTS.pdf", "Test Results — suite, chaos, AI evals, baseline", DOC03),
    ("04_SECURITY_AND_TRUST.pdf", "Security & Trust — policy, webhooks, idempotence, limits", DOC04),
    ("05_DEMO_GUIDE.pdf", "Demo Guide — reproduce the nine acts", DOC05),
]

EVIDENCE_FILES = [
    # (repo source, pack dest)
    ("docs/demo/paypal-live-receipts.json", "evidence/paypal-live-receipts.json"),
    ("docs/demo/paypal-live-receipts-2.json", "evidence/paypal-live-receipts-2.json"),
    ("docs/hackathon/RELEASE_EVIDENCE_MANIFEST.json", "evidence/RELEASE_EVIDENCE_MANIFEST.json"),
    ("docs/evals/METRICS_SUMMARY.md", "evidence/evals/METRICS_SUMMARY.md"),
    ("docs/evals/BASELINE_COMPARISON.md", "evidence/evals/BASELINE_COMPARISON.md"),
    ("docs/evals/FAILURE_ANALYSIS.md", "evidence/evals/FAILURE_ANALYSIS.md"),
    ("docs/evals/baseline-comparison.json", "evidence/evals/baseline-comparison.json"),
    ("docs/evals/report-2026-11-08T01-04-16-487Z.json", "evidence/evals/report-2026-11-08T01-04-16-487Z.json"),
    ("docs/evals/report-2026-11-08T01-06-49-512Z.json", "evidence/evals/report-2026-11-08T01-06-49-512Z.json"),
    ("docs/evals/report-2026-11-08T01-08-51-850Z.json", "evidence/evals/report-2026-11-08T01-08-51-850Z.json"),
    ("docs/evals/report-2026-11-08T11-39-54-355Z.json", "evidence/evals/report-2026-11-08T11-39-54-355Z.json"),
    ("postman/AFTERPACT.postman_collection.json", "evidence/postman/collection.json"),
    ("postman/newman-report.json", "evidence/postman/newman-report.json"),
    ("docs/sponsors/channel3-live-report.json", "evidence/channel3-live-report.json"),
    ("brag-output/paypal-ai-2026/VIDEO_QA_REPORT.md", "evidence/VIDEO_QA_REPORT.md"),
    ("brag-output/paypal-ai-2026/VIDEO_SHOT_MAP.md", "evidence/VIDEO_SHOT_MAP.md"),
    ("brag-output/paypal-ai-2026/NARRATION_EN.txt", "evidence/NARRATION_EN.txt"),
]

README_TXT = """AFTERPACT — Judge Evidence Pack (PayPal AI Hackathon 2026)
=====================================================
Date: 2026-11-09 · Commit: a2be8424
Repo: https://github.com/toskaman/afterpact
Demo: https://199.247.9.188.nip.io (live through Dec 15, 2026)

Start with 00_EXECUTIVE_BRIEF.pdf (60-second verification path inside),
then 05_DEMO_GUIDE.pdf to reproduce the nine acts live.

PDFs (claims, each with sources)          evidence/ (raw artifacts)
--------------------------------          -------------------------
00_EXECUTIVE_BRIEF.pdf                     paypal-live-receipts*.json
01_ARCHITECTURE.pdf                        RELEASE_EVIDENCE_MANIFEST.json
02_PAYPAL_EVIDENCE.pdf                     evals/ (4 runs + summaries)
03_TEST_RESULTS.pdf                        postman/ (collection + Newman)
04_SECURITY_AND_TRUST.pdf                  screenshots/ (15 app captures)
05_DEMO_GUIDE.pdf                          VIDEO_QA_REPORT.md + SHOT_MAP
                                           channel3-live-report.json

Honesty posture: mock transport and recorded runs are always labeled in-app
and in this pack. Nothing simulated is presented as live. All secrets redacted.
"""


def secret_scan(path):
    """Fail-closed: refuse to pack files containing likely key material."""
    text = path.read_bytes()
    lowered = text.lower()
    needles = [b"client_secret", b"private_key", b"bearer ", b"sk-live",
               b"sk_live", b"api_key=", b"apikey=", b"license_key="]
    hits = [n for n in needles if n in lowered]
    # allow the literal word 'redacted' contexts only; any needle is a fail
    return hits


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for fname, title, blocks in DOCS:
        p = build_pdf(fname, title.split(" — ")[0], HDR + " · " + title, blocks)
        print(f"pdf: {p.name} ({p.stat().st_size // 1024} KB)")
    for src, dest in EVIDENCE_FILES:
        s = ROOT / src
        assert s.exists(), f"missing source: {src}"
        hits = secret_scan(s)
        assert not hits, f"secret scan hit in {src}: {hits}"
        d = OUT / dest
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(s, d)
    shots = sorted((ROOT / "docs/demo/screenshots").glob("*.png"))
    assert shots, "no screenshots found"
    (OUT / "evidence/screenshots").mkdir(parents=True, exist_ok=True)
    for s in shots:
        shutil.copyfile(s, OUT / "evidence/screenshots" / s.name)
    (OUT / "00_README.txt").write_text(README_TXT, encoding="utf-8")
    zip_path = BASE / "AFTERPACT_JUDGE_EVIDENCE_PACK.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(OUT.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(OUT))
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"zip: {zip_path.name} ({size_mb:.1f} MB)")
    assert size_mb <= 35, f"pack exceeds 35 MB: {size_mb:.1f}"
    print("OK — pack within 35 MB budget")


if __name__ == "__main__":
    main()

