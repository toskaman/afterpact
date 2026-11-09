# AG Studio trial status

Date: 2026-11-08. This is the authoritative trial record (referenced by
`scripts/vendor-ag-studio.mjs`).
Update 2026-11-09: owner authorized the full consent flow. Sponsor page
re-verified live: 45-day trial via web form; hackathon contact channel
is the AG Grid team on the PayPal Discord
(discord.com/invite/sJ2G6DyvSK), info@ag-grid.com as fallback. Consent
send + trial-form submit stay owner-side (owner mailbox and identity —
the agent has no email/Discord access); key-install plumbing is done
and tested (Trial key, step 3).

## Installed

- Product: AG Studio 3.1.0 (commercial), EULA v40 filed at
  `apps/web/public/vendor/ag-studio.LICENSE.html`.
- Distribution: official AG Grid CDN
  (`https://cdn.jsdelivr.net/npm/ag-studio@3.1.0/dist/umd/ag-studio.min.js`,
  SHA-256 pinned `9b83bf50…24ecc`, SRI-checked in the browser), with a
  build-time-fetched gitignored local copy as fallback. No commercial
  bytes are committed to this repo.
- Key: none installed. `AG_STUDIO_LICENSE_KEY` is read from the
  environment at deploy time (see `.env.example`, `render.yaml`); until
  set, the canvas shows the AG trial watermark, disclosed in-UI.

## Trial key (owner action, ~5 min)

1. Complete the 45-day trial form (owner, ~2 min):
   https://www.ag-grid.com/studio/javascript/enterprise-licence/#request-a-45-day-trial-licence
   (form verified live 2026-11-09; for trial issues use the PayPal
   Discord AG Grid channel). The key arrives by email.
2. Save the key to local `APIS.txt` / `.env` (never commit) and hand it
   to the agent (paste in chat — never in a screenshot or file).
3. Agent installs it the same day into the root-only file
   `/root/afterpact-studio-key` (chmod 600) on the demo box, redeploys
   (`scripts/afterpact_deploy.sh` exports it as `AG_STUDIO_LICENSE_KEY`;
   empty file = current watermark behavior), and verifies watermark
   removal by screenshot. Key passthrough is covered by
   `tests/integration/sponsors.studio-toggle.test.ts` (fake key).
4. Confirm in writing that the trial covers the judging window
   (Dec 1–15, 2026) and the public demo URL — status UNKNOWN until then.

Note: the website advertises 45 days while EULA v40 cl.13.2(b) describes
60 days; the key's own terms govern. Ask AG Grid to confirm.

## Consent request (owner sends, draft below)

EULA v40 limits trial use to internal evaluation and bars redistribution
without prior written consent (cl.16.1); git history also still contains
the previously vendored bytes. Send this to the AG Grid team on the
PayPal Discord (primary channel per the sponsor page) or to
info@ag-grid.com, and file the reply here:

> Subject: Hackathon consent request — AG Studio 3.1.0 in public demo
> repo (AFTERPACT, PayPal AI Hackathon 2026)
>
> We built our Intelligence Studio view on ag-studio@3.1.0 (trial
> watermark until keyed; key via deploy-time env, never committed),
> loaded from your official CDN with SHA pinning, with your LICENSE
> text and copyright attribution filed in-repo. Per EULA v40 cl.13/16.1
> we seek prior written consent to (a) serve the unmodified UMD bytes
> from our hosted judging demo https://199.247.9.188.nip.io through
> Dec 15 2026, and (b) cover the previously vendored bytes still
> present in our public repo's git history (removed from the tracked
> tree; no history rewrite planned without your guidance). If declined,
> we will fall back to the MIT-licensed AG Grid Community edition
> before judging. Please confirm the applicable trial duration
> (45 vs 60 days) and any required attribution. Thank you.

## Fallback

If consent is declined or the trial cannot cover judging: set
`AG_STUDIO_DISABLED=1` on the demo box and redeploy — the Studio UMD is
never loaded and the view serves Community tables only (tested in
`tests/integration/sponsors.studio-toggle.test.ts`). Then retract the
AG Grid sponsor claim to Community-only usage. Cutoff: Nov 11 EOD;
without written consent by then, ship Community-only.
