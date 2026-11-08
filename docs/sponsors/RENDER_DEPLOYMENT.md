# [NOT PURSUED] Render deployment — reference only

> 2026-11-08 redirect: the Render prize is NOT pursued (no payment card)
> and no Render service, URL, or dashboard exists. The live demo runs on
> Vultr — see `docs/demo/VULTR_HOSTING.md`. Everything below is a kept
> deployment-as-code reference (`render.yaml`), not a claimed deployment.

Date: 2026-11-07. Blueprint + CI are in the repo; no live Render service
exists or is planned.

## What exists

- `render.yaml` — deployment-as-code Blueprint: Node 24 web service,
  `npm ci && npm run build`, `npm start`, health check on `/api/health`,
  1 GB persistent disk at `/var/data`, sandbox-only PayPal defaults,
  secret keys as `sync: false` (set in the Render dashboard, never in git).
- `.github/workflows/ci.yml` — install → typecheck → frontend syntax
  check → full Vitest suite → build → compiled-server smoke test
  (health, config labels, vendor bundle, flagship completion).
- Health endpoint for Render + judges: `GET /api/health`
  (`status/transport/auditChainValid/killSwitch`).

## Deploy steps (human, ~10 min)

1. Push this repo to GitHub (public) and create a Render account.
2. Render dashboard → New → Blueprint → select the repo (`render.yaml`
   is auto-detected) → Apply.
3. In the service Environment tab, set secrets if the live paths should
   demo: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
   `CHANNEL3_API_KEY`. Without them the service runs in mock-simulated
   mode with discovery unconfigured — fully demoable, honestly labeled.
4. Wait for the build; verify `https://<service>.onrender.com/api/health`
   returns `{"data":{"status":"ok",…}}`.
5. Run the flagship once against the hosted URL and confirm
   `status: completed` (see `docs/demo/DEMO_SCRIPT.md`).
6. Paste the live URL into the README (Live demo section), the Devpost
   submission, and the demo video description.

## Render Workflows — NOT claimed

The prize plan notes Render Workflows (durable multi-step execution)
would strengthen a Render prize case. No workflow code exists in this
build: without a Render account the executions cannot be created,
observed, or evidenced, and unexecuted workflow code would be
submission Theater. If pursued later, the honest candidates are:
payment reconciliation sweeps, refund-status verification, and
resolution-report generation — each a real cron/workflow with dashboard
observability, not a local stub.

## Availability note for judges

The demo must stay free and unrestricted until Dec 15, 2026. The
`starter` plan avoids free-tier sleep. Demo state lives on the attached
disk; if the disk is ever wiped, `POST /api/demo/run` reproduces the
flagship from scratch in seconds.
