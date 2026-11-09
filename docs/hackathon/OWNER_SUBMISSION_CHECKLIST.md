# Owner pre-submission checklist (PayPal AI Hackathon 2026)

Deadline: **Nov 12, 2026, 12:00 PM PT / 21:00 Paris**. Everything else is done;
only the items below need the owner's account, inbox, or decision.

## 1. YouTube upload (~10 min)

1. Upload `brag-output/paypal-ai-2026/AFTERPACT_PAYPAL_AI_FINAL.mp4` as **Public**.
2. Copy title/description/tags from `DEVPOST_YOUTUBE_METADATA.md` (same folder).
3. Attach `AFTERPACT_PAYPAL_AI_FINAL.srt` as the caption track.
4. Paste the public URL into: README video line, `docs/demo/DEVPOST_DRAFT.md`
   (`TBD:youtube-url`), and the Devpost video field.

## 2. Devpost submit (~20 min)

1. Paste sections from `docs/demo/DEVPOST_DRAFT.md` (all fields written; numbers
   verified 2026-11-09: 319 tests, 15 E2E, evals 117/120, Newman 37/37+18/18).
2. Links: repo `https://github.com/toskaman/afterpact`, demo
   `https://199.247.9.188.nip.io`, YouTube URL from step 1.
3. Confirm on the form: deadline, track, sponsor-prize selection (AG Grid only),
   AI-tools disclosure (already drafted).
4. Submit, then confirm back so the exact submitted revision + artifacts get
   snapshotted (`POST_SUBMISSION_CHANGELOG.md`).

## 3. AG Grid trial + consent (before Nov 11 EOD or fallback triggers)

1. ~~Register the 45-day Studio trial key~~ DONE 2026-11-09 (AG-151025,
   expires 2026-12-24, installed, LICENSED verified).
2. ~~Send the consent mail~~ SENT 2026-11-09 by owner — file AG Grid's
   reply in `docs/sponsors/ag-studio-trial.md` on arrival (covers demo
   thru Dec 15 + history bytes).
3. Reply declines, or no reply by Nov 11 EOD → agent ships
   Community-only (`AG_STUDIO_DISABLED=1`) and retracts Studio claims.
   No reply = fallback.

## 4. Usability (any 1–5 volunteers, 30 min each)

1. Recruit anyone with ops/support/e-commerce exposure (no coaching, consent first).
2. Run `docs/benchmarks/USABILITY_STUDY.md` scenarios; record anonymized notes.
3. Even n=1 honestly reported beats NOT MEASURED. Zero sessions = keep the
   honest labels already in the draft (no fabrication, ever).

## 5. Keep the lights on (to Dec 15)

1. Keep the Vultr box + credits alive through Dec 15, 2026 (judging).
2. Do not decommission, do not rotate infra without telling the agent.

## Do NOT do

- Submit or publish under time pressure without the Section 2 link check.
- Paste any secret into Devpost/YouTube (demo needs none).
- Claim the AG Grid prize on Studio if Section 3 lapsed into fallback.
