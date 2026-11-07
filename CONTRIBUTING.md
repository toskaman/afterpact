# Contributing to AFTERPACT

## Ground rules

1. **Money is exact.** Integer minor units end to end; currency-aware
   decimals; no floats in domain logic or persistence. PayPal wire
   strings are formatted at the boundary only.
2. **Policy gates money.** No new payment-affecting path without a
   deterministic policy check and a test proving the refusal case.
3. **Everything is labeled.** New data sources get an origin marker in
   `ORIGINS` (`apps/web/public/app.js`), a `/api/config` feature flag,
   and a row in the README labeling table. Unbadged simulated money is a
   release-blocking bug.
4. **Never fabricate.** Tests needing credentials skip visibly. Stubs are
   for error shapes only and are named `*stub*`. Docs flip TBD→evidence
   only with a built, green artifact.
5. **No secrets in the repo.** `.env` is untracked; `.env.example` holds
   placeholders. API responses carry presence booleans, never key material.

## Workflow

```bash
npm install
npm run typecheck
npm run test:unit        # fast, no network
npm run test:integration # spins local servers; live-sandbox skips without creds
npm run build && npm start
```

- One concern per change; run the touched area's tests before pushing.
- New endpoints: add the route, the `Ops` method, a Postman request, and
  an HTTP-level test in `tests/integration/`.
- New UI views: add the route + nav entry, keep WCAG measures (labels,
  focus, `aria-live` for async state), and verify over HTTP (no
  Playwright in this repo).
- New dependencies: permissive licenses only (MIT/ISC/Apache-2.0);
  record the license in the README/SBOM row and in `docs/RELEASE_GATE.md`.

## Environment quirks

- On Windows SMB shares, `npm install` fails on workspace symlinks
  (`ENOTSUP`) and `npx`/shims reject UNC paths. Work from the `Z:`
  drive-letter path and invoke binaries via
  `node node_modules/<pkg>/…`. CI (Ubuntu) is authoritative for
  `npm ci`.
- `AGENTS.md`-style local instructions are not loaded in untrusted
  checkouts; this file + `README.md` + `SECURITY.md` are the contract.

## Release gate

No release without `docs/RELEASE_GATE.md` updated: full suite green,
typecheck green, flagship repro green, clean-install check green, and a
PASS/FAIL per gate with evidence. Never mark PASS on an unexecuted path.
