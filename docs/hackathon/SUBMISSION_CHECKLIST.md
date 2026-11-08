# AFTERPACT submission checklist (PayPal AI Hackathon 2026)

Deadline: **Nov 12, 2026, 12:00 PM PT**. Source: `OFFICIAL_RULES_AUDIT.md`
(rules prevail over this list).

## Repo (public, open-source)

- [x] Repo is PUBLIC: `https://github.com/toskaman/afterpact` (`main`,
      pushed 2026-11-07; GitHub Actions CI `success`).
- [x] OSI-approved license file at top level (`LICENSE`, MIT).
- [x] Dependency licenses reviewed: runtime `zod` (MIT); vendored AG Grid
      Community (MIT + license file); dev-only TypeScript/Vitest (Apache/MIT).
- [x] No secrets anywhere: `.env` absent/untracked, `.env.example`
      placeholders only, key-material scan clean (release gate 13).
- [x] README has: problem, differentiation, PayPal, AI scope, real-vs-simulated,
      install, test, flagship repro, proofs, sponsors, limitations, license.
- [x] `SECURITY.md`, `CONTRIBUTING.md` present.
- [x] Proprietary sponsor files: NONE redistributed (release gate 14).

## Functional demo

- [x] Hosted demo URL live: `https://199.247.9.188.nip.io` (Vultr;
      Render not pursued — card required. README run instructions too).
- [x] Demo stays free + unrestricted until **Dec 15, 2026** (Vultr box on
      owner credits; destroy after judging per `VULTR_HOSTING.md`).
- [x] Flagship repro verified locally (`completed`, 9 acts) AND on the
      hosted URL (`completed`, 9 acts, verified 2026-11-07).
- [x] Judges' key instructions documented (`docs/demo/KEY_RETRIEVAL_GUIDE.md`
      — steps only, never the keys themselves).

## Video (<3 min, public YouTube)

- [ ] Footage of the running project (no mockups/static prototype).
- [ ] Under 3 minutes; problem/audience/why covered; end-to-end working shown.
- [ ] No unlicensed trademarks/music; English or translated.
- [ ] Transport/origin pills visible; sandbox-vs-mock labeled in captions.

## Devpost submission text

Draft: `docs/demo/DEVPOST_DRAFT.md` (all sections written; URLs pasted as
they land). Repo URL filled; demo + video URLs pending human steps.

- [x] Feature description (what it does, complete product story).
- [x] PayPal centrality explicit (Orders v2 + capture + refund + webhooks).
- [x] **List of AI tools used + how each was used** (Vultr Inference
      model + deterministic gates/fallbacks; usage in `docs/evals/README.md`).
- [x] Real-vs-simulated disclosure (what is live, what is simulated, what
      needs keys).
- [x] Sponsor usage stated exactly: AG Studio canvas + agent (trial
      watermark until licensed) + Community tables, Channel3
      live-when-keyed, Bryntum fallback (not Bryntum), Render
      hosting, Postman collection. APIMatic/AG Studio/Bryntum prizes NOT
      claimed.
- [ ] Public repo URL + demo URL + video URL all present and reachable
      (repo + demo done; video is the owner's step, later).

## Rules compliance

- [ ] Eligibility confirmed (age/team/rep; no excluded region/conflict).
- [ ] Stage One gate: fits theme + reasonably applies PayPal + AI.
- [ ] One Grand + at most one Sponsor targeted (no stacking assumed).
- [ ] IP: team owns the submission or has rights; third-party assets licensed.
- [ ] Availability Dec 1–15 for judging; representative reachable ~Dec 21.

## Pre-submit verification (day before)

- [x] `npm ci && npm run typecheck && npm test && npm run build` green
      on a clean checkout (Linux/CI) — GitHub Actions `success` 2026-11-07.
- [ ] `docs/RELEASE_GATE.md` all green with no inflated PASS.
- [ ] Click every README/Devpost link from an incognito window.
- [ ] Re-run the flagship on the hosted URL; confirm `chainValid: true`.
