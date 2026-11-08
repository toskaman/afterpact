# AFTERPACT — Hosted Demo (Vultr)

**URL:** `https://199.247.9.188.nip.io`
**Verified:** 2026-11-08 — `/api/health` ok (valid production LE cert),
build `6a219bf` (= HEAD), `/` 200, remote flagship `completed`, operator
token gate 401-checked, `features.agStudio=ag-studio`, `/api/ai/status`
honest `keyed:false` (mock box carries no inference key; AI surfaces show
`AI · OFF`), gallery + P1-T tokens served live. Operator token rotated
into gitignored `APIS.txt`.

## Stack

- Vultr vc2-1c-1gb (1 vCPU, 1 GB, $5/mo on owner's credits), Paris (cdg),
  Ubuntu 24.04. Instance `afterpact-demo`, 199.247.9.188.
- Caddy reverse proxy with automatic HTTPS (`<ip>.nip.io`).
- App as systemd service (`afterpact.service`, user `www-data`),
  restarted on failure, enabled at boot.

## Honest operating mode

The hosted demo runs the **mock PayPal transport**: no secrets live on
this box, and the one-click flagship always completes (no buyer account
needed). Every simulated surface carries its `SIMULATED · MOCK` badge.
Live sandbox/Channel3 paths are proven separately (see
`docs/RELEASE_GATE.md` gate 15) and unlock with keys per `.env.example`.

## Reproduce / redeploy

```bash
# From the repo tip (idempotent; reruns tests on the box):
scp scripts/afterpact_deploy.sh root@199.247.9.188:/root/
ssh root@199.247.9.188 'bash /root/afterpact_deploy.sh'
```

The deploy script installs Node 24 + Caddy, clones the public repo,
`npm ci`, `npm run build`, `npm test`, then enables the service and
Caddy (ports 80/443 opened in ufw — Vultr images ship SSH-only).

## Operations

- Health: `GET /api/health` (no secrets in output).
- Logs: `journalctl -u afterpact.service`.
- Reset demo state: `POST /api/demo/reset` with
  `Authorization: Bearer $OPERATOR_TOKEN` (token printed once at deploy,
  saved in local `APIS.txt`, never committed). Anonymous reset → 401.
- Keep the box until judging ends (Dec 15, 2026), then destroy it from
  the Vultr panel (or `DELETE /v2/instances/<id>`).
- Cost: ~$5/mo while it lives; the account holds ample credit.

## Why not Render

Render's free tier requires a credit card the owner doesn't have, so the
Render prize is not pursued. `render.yaml` stays in the repo as a
reference Blueprint. No Render service, URL, or dashboard exists — nothing
about Render is claimed.
