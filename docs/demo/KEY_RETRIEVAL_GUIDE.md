# AFTERPACT — Key Retrieval Guide (do once, ~10 minutes)

You own zero API keys today. Everything below is **free** and takes one
short session. The agent cannot do these steps for you: PayPal needs your
account, Channel3 signup sits behind a human challenge (Turnstile), and
verification emails go to your inbox. Do it once, paste into `.env`, and
the live paths unlock permanently.

Hackathon help channel: `https://discord.com/invite/HP4BhW3hnp`
(from the [hackathon page](https://paypalaihackathon.devpost.com/)).

## 1. PayPal Sandbox (free, ~5 min)

1. Log in (or sign up free) at `https://developer.paypal.com/`.
2. Open the **Dashboard → Apps & Credentials**.
3. Toggle to **Sandbox**, click **Create App**, name it `AFTERPACT`.
4. Copy the **Client ID** and **Secret** (click "Show").
5. Optional but recommended: create a sandbox **buyer** account
   (Testing Tools → Sandbox Accounts) — you will approve the Act 4
   payment with it during the demo/video.
6. Optional: webhooks — copy the webhook ID later if you register the
   app's webhook URL; the suite covers webhooks with the mock signer.

Paste into `.env` (never commit it):

```bash
PAYPAL_CLIENT_ID=<sandbox client id>
PAYPAL_CLIENT_SECRET=<sandbox secret>
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=<optional>
```

Verify (from `Z:/Hackatons/Paypal`):

```bash
node node_modules/vitest/vitest.mjs run tests/integration/paypal.live
curl -X POST http://localhost:3001/api/demo/run -H 'content-type: application/json' -d '{"scenario":"flagship"}'
# Act 4 returns awaiting-action + approveUrl → approve in browser as the
# sandbox buyer → POST /api/demo/runs/:id/continue
```

## 2. Channel3 (free, ~3 min)

Sponsor offer for hackathon participants: **free API key with 20K credits,
no credit card**, at `https://trychannel3.com/developers`
(announced on the sponsor's LinkedIn; default free tier is 1,000 searches).
If the hackathon quota is not applied automatically, ask in the hackathon
Discord (above) — do not invent a promo code.

1. Sign up / log in at `https://trychannel3.com/developers` (human step).
2. Open the dashboard, **generate an API key**.
3. Paste into `.env`:

```bash
CHANNEL3_API_KEY=<key>
```

4. Verify: restart the API, run flagship Act 2 or open `#/discovery` —
   the badge flips from `DISCOVERY UNAVAILABLE` to `CHANNEL3 · LIVE`
   and the request is logged in the Flight Recorder.

Notes: the app calls `POST /v1/search` (+ product/lookup) on
`https://api.trychannel3.com` with an `X-API-Key` header; without a key
discovery fails closed (HTTP 503) and never fabricates data.

## 3. Render (your deploy step, free tier)

1. Sign up at `https://render.com` (GitHub login is fastest).
2. **New → Blueprint**, point at this repo (`render.yaml` is included).
3. Set env vars on the service: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
   (sandbox), `CHANNEL3_API_KEY`, `PAYPAL_MODE=sandbox`.
4. Deploy, then paste the URL into `README.md` (Live demo line) and the
   Devpost draft. Free tier must stay up through judging (Dec 15, 2026).

## 4. GitHub (already done by the agent)

Public repo `afterpact` on your account, branch `main`, pushed from this
machine. CI (`.github/workflows/ci.yml`) runs tests + build + flagship
smoke on every push.

## What goes where (recap)

| Secret | File | Committed? |
|---|---|---|
| `PAYPAL_CLIENT_ID/SECRET` | `.env` only | Never (git-ignored) |
| `CHANNEL3_API_KEY` | `.env` only | Never (git-ignored) |
| Placeholders + non-secret config | `.env.example` | Yes |
| Render env vars | Render dashboard | n/a |

After keys are in: re-run `npm test` (the live probe stops skipping),
`npm run build`, and the flagship — then record the video.
