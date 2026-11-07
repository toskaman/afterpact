# APIMatic evidence — NOT USED, NOT CLAIMED

Date: 2026-11-07.

## Statement

The PayPal API Context Plugin (APIMatic) was **not installed or used**
during this build. No APIMatic tooling touched the code, prompts, or
PayPal request shapes at any stage. Consequently this project makes
**no claim** on the APIMatic sponsor prize and must not be judged for it.

## Why this file exists

The prize plan (`docs/hackathon/PRIZE_STRATEGY.md`) explicitly requires:
"Do NOT claim this prize if the plugin was not actually used." This file
is the affirmative non-claim, so the release gate can mark APIMatic as
`NOT PURSUED` instead of leaving it ambiguous.

## What validated PayPal correctness instead

Without the plugin, PayPal wire correctness rests on:

- Zod wire schemas + transport mapping tested against stubbed provider
  responses (`tests/integration/paypal.safety.test.ts`, `paypal.flows.test.ts`)
- The live-sandbox probe (`tests/integration/paypal.live.test.ts`), which
  executes only with real credentials and skips visibly otherwise
- `docs/payments/PAYPAL_INTEGRATION.md` as the human-reviewed contract

If a future session installs the Context Plugin, replace this file with
dated evidence (validated requests, schema corrections attributable to
the plugin) per the prize plan.
