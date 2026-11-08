# AFTERPACT — Official Rules Audit

Source of truth: [Official Rules](https://paypalaihackathon.devpost.com/rules) and
[Hackathon overview](https://paypalaihackathon.devpost.com/).
Rules prevail over all other materials (rules §11). Verified 2026-11-07 via
independent fetch of rules body, overview body, and PayPal dev blog post.
Unverified items are marked UNVERIFIED below.

## Dates

| Milestone | Date (PT) |
|---|---|
| Submission period start | Oct 1, 2026, 9:15 AM PT |
| Submission deadline | Nov 12, 2026, 12:00 PM PT (9:00 PM Paris) |
| Judging | Dec 1, 2026, 2:00 PM PT – Dec 15, 2026, 8:00 AM PT |
| Winners announced | On/around Dec 21, 2026, 2:00 PM PT |

~30,424 participants listed on overview page. Event is online/public.

## Eligibility

- Open to individuals of age of majority, teams, and organizations.
- One person may join multiple teams AND enter individually.
- Teams/orgs must appoint an authorized Representative.
- EXCLUDED: residents/orgs in US-sanctioned/embargoed or listed regions
  (including Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea);
  Promotion Entities (PayPal, Devpost) + employees/agents/families;
  judges + their employers; affiliates; conflicts of interest.

## Required technologies

Per rules §4 "What to Create" + overview Requirements:

1. An app integrating the PayPal developer platform in the free sandbox
   (includes Venmo/Braintree/Xoom/Honey/Zettle rails). PayPal integration
   must be CENTRAL to the project.
2. PLUS an AI tool/model/platform of choice (any AI tool works).
3. Sponsor tools (AG Grid, APIMatic, Astropods, Bryntum, Channel3, Elastic,
   KERNEL, Postman, Render, Zapier) are OPTIONAL, never required.
4. Stage One pass/fail gate: fits theme + reasonably applies required APIs/SDKs.

## Technical deliverables / submission requirements

1. Project meeting the requirements above.
2. Text description of features.
3. FUNCTIONAL demo: runnable working build via complete setup/run instructions
   in the repo OR a hosted demo URL. Mockups, static prototypes, and
   non-functional demos FAIL.
4. PUBLIC repo URL (GitHub/Bitbucket/GitLab) with all source + assets + instructions.
5. Demo video under 3 minutes (judges need not watch more); footage of the
   project on the target device; public YouTube link; no unlicensed
   trademarks/music.
6. List of AI tools used + how each was used (overview requirement).
7. Login credentials / API keys / sandbox credentials if the judges need them.
8. All materials in English or with translation.

## Public repository + license

- Repo must be PUBLIC and OPEN SOURCE with an open-source license file that is
  detectable/visible at the top of the repo page (About section).
- Use an OSI-approved license (MIT or Apache-2.0 recommended); check dependency
  compatibility. Do NOT use a source-available license as a substitute.
- Proprietary sponsor SDK files may be used per their license but must not be
  improperly redistributed.

## Evaluation criteria (5, equally weighted; rules §6)

1. Technological Implementation — thorough/skilful PayPal + AI use; working,
   non-trivial build.
2. Design — complete, coherent product experience.
3. Potential Impact — credible, specific case for a real problem / real audience;
   solution addresses it as demoed.
4. Innovation/Idea — creativity and novelty.
5. Presentation — video shows end-to-end working; pitch covers
   problem/audience/why; easy to follow.

Tie-break: highest score on first-listed criterion, then next; then judges vote.

## Prize categories

Grand: 1st $12,000 / 2nd $8,000 / 3rd $5,000.
Honorable Mentions ($5,000 each): Most Creative, Most Impactful,
Best Demo Delivery, Best Use of PayPal+AI, Best Use of Agentic Commerce.
Sponsors: AG Grid 1st $5K / 2nd $2K / 3rd 3x$1K;
APIMatic 3x$1K + 6-month Business subscription each;
Bryntum 3x$1K; Channel3 1x$1.5K;
Render 1st $1K / 2nd $750 / 3rd $500 in Render credits (not cash).
Headline total: $67,500 cash + $2,250 credits = $69,750; 23 prizes.

Note: prize-total header text is inconsistent across pages ($67,500 vs $69,750
vs PayPal blog $60,000+) but the per-prize table is consistent everywhere.

## Multiple-prize restriction

A project can win at most ONE (1) Grand Prize + ONE (1) Sponsor Prize,
OR ONE (1) Honorable Mention + ONE (1) Sponsor Prize.
Multiple submissions per entrant allowed, but each must be unique /
substantially different.

## Sponsor-specific criteria (verified)

Sponsor prizes are open to all eligible submissions that USE that sponsor's
tools (rules §8). Partner roles per the PayPal dev blog:

- AG Grid via AG Studio: embedded analytics/dashboards/AI assistant.
  Official Devpost prize name is "Best Use of AG Grid" (AG Grid's blog
  calls it "Best Use of AG Studio"). Judged on polish (custom widgets,
  theming, layout) + use of Studio Agent Framework.
- APIMatic: Context Plugin giving AI agents PayPal API context.
- Bryntum: Gantt/Scheduler/Calendar/Grid web components.
- Channel3: product-data API (100M+ items); must actually CALL the API or MCP
  server — mention-only does not qualify.
- Render: deploy/orchestrate agents (Render Workflows = durable multi-step
  execution).
- Elastic, Postman, KERNEL, Astropods, Zapier: no cash prizes; optional use.

UNVERIFIED: verbatim per-sponsor rubric text — Devpost /details pages for
aggrid/apimatic/bryntum/channel3/render (+ others) returned HTTP 403 to the
fetcher. Substance above comes from rules §8, the PayPal dev blog, and opened
official sponsor docs (AG Studio blog + payments-dashboard tutorial,
trychannel3.com/developers, APIMatic context-plugins blog, Render docs).

## Intellectual property / third-party licenses

- Submissions remain entrant IP; sponsor gets a non-exclusive license to use
  the entry for judging.
- Sponsor/Devpost may promote the submission and use contributors'
  name/likeness/voice/image for 3 years; some components displayed publicly.
- Entry must be original, solely owned, no third-party IP/privacy violations.
- Open source allowed if licensed + entrant builds on it.
- Contractors allowed if the work is the entrant's result.

## Financial-operation restrictions

- Project must NOT have been developed/derived with financial or preferential
  support from Sponsor/Administrator (funding, investment, contract dev,
  commercial license before end of Submission Period).
- Sponsor may disqualify on real/apparent conflict of interest.
- PayPal Sandbox ONLY for hackathon payment demos; production financial
  operations stay disabled.

## Long-term evaluation accessibility

Entrant must make the Project available FREE and WITHOUT RESTRICTION for
testing/evaluation/use by Sponsor/Administrator/Judges UNTIL THE JUDGING
PERIOD ENDS (Dec 15, 2026, 8:00 AM PT). Demo must stay live through that date.

## Disqualification risks (rules §§4,6,9,11)

- Non-functional demo; mockups/static prototypes.
- Private repo or missing visible OSS license.
- Video over-reliance past 3 min / non-public YouTube / unlicensed material.
- IP infringement; undisclosed pre-existing project without "significant" update.
- Third-party SDK used without authorization.
- Financial/preferential support from PayPal/Devpost.
- Tampering / unsportsmanlike conduct.
- Incomplete/late/misdirected submission (sole remedy: request resubmission at
  sponsor discretion).
- Failure to return Required Forms within 10 business days.
- Official Rules amendable at any time — re-check before submitting.
- Prize delivery within 60 days of completed affidavit/forms; winners pay
  taxes/fees; W-9/W-8BEN may be required.

## PayPal API surface verified (sandbox-first)

- Orders v2: POST /v2/checkout/orders (create), GET/PATCH,
  POST confirm-payment-source, authorize, CAPTURE
  /v2/checkout/orders/{id}/capture. Capture requires buyer approval via
  rel:approve link or valid payment_source; Client-Credentials token at
  api-m.sandbox.paypal.com.
- Refunds: POST /v2/payments/captures/{capture_id}/refund
  (empty body = full, amount = partial).
- Webhooks: HTTPS posts to subscribed URL, up to 10 URLs/app, per-app event
  scoping.
- Resources: JS SDK v6, REST API, sandbox starter, webhooks,
  Agent Toolkit/MCP quickstarts (devpost /resources page).

## Gaps / to verify before submission

1. Sponsor /details rubric verbatim text (403-blocked) — re-check manually.
2. FAQs page (/details/faqs) and Updates/Discussions — not opened; may hold
   clarifications (rules still prevail).
3. Standalone AG Studio / Channel3 / Bryntum / Render docs bodies — only
   partner-role lines + search snippets verified so far.
4. Entrant's own eligibility (region, conflicts) — confirm manually.
