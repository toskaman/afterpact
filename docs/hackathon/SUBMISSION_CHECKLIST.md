# AFTERPACT submission checklist (PayPal AI Hackathon 2026)

Deadline: **Nov 12, 2026, 12:00 PM PT**. Source: `OFFICIAL_RULES_AUDIT.md`
(rules prevail over this list).

## Repo (public, open-source)

- [ ] Repo is PUBLIC on GitHub/Bitbucket/GitLab with all source + assets.
- [ ] OSI-approved license file at top level, visible/detectable
      (`LICENSE`, MIT). No source-available substitute.
- [ ] Dependency licenses reviewed: runtime `zod` (MIT); vendored AG Grid
      Community (MIT + license file); dev-only TypeScript/Vitest (Apache/MIT).
- [ ] No secrets anywhere: `.env` untracked, `.env.example` placeholders
      only, no keys in tests/fixtures/video.
- [ ] README has: problem, differentiation, PayPal, AI scope, real-vs-simulated,
      install, test, flagship repro, proofs, sponsors, limitations, license.
- [ ] `SECURITY.md`, `CONTRIBUTING.md` present.
- [ ] Proprietary sponsor files: NONE redistributed (no AG Studio/Bryntum
      trial binaries in the repo — verified by `docs/RELEASE_GATE.md`).

## Functional demo

- [ ] Hosted demo URL live (Render Blueprint applied) OR complete
      setup/run instructions in README (both preferred).
- [ ] Demo stays free + unrestricted until **Dec 15, 2026**.
- [ ] Flagship repro verified on the submission build (`completed`, 9 acts).
- [ ] Judges' credentials/keys documented if needed (sandbox creds /
      Channel3 key instructions — never the keys themselves).

## Video (<3 min, public YouTube)

- [ ] Footage of the running project (no mockups/static prototype).
- [ ] Under 3 minutes; problem/audience/why covered; end-to-end working shown.
- [ ] No unlicensed trademarks/music; English or translated.
- [ ] Transport/origin pills visible; sandbox-vs-mock labeled in captions.

## Devpost submission text

- [ ] Feature description (what it does, complete product story).
- [ ] PayPal centrality explicit (Orders v2 + capture + refund + webhooks).
- [ ] **List of AI tools used + how each was used** (deterministic
      components listed as deterministic; no LLM inference claimed).
- [ ] Real-vs-simulated disclosure (what is live, what is simulated, what
      needs keys).
- [ ] Sponsor usage stated exactly: AG Grid Community (not Studio),
      Channel3 live-when-keyed, Bryntum fallback (not Bryntum), Render
      hosting, Postman collection. APIMatic/AG Studio/Bryntum prizes NOT
      claimed.
- [ ] Public repo URL + demo URL + video URL all present and reachable.

## Rules compliance

- [ ] Eligibility confirmed (age/team/rep; no excluded region/conflict).
- [ ] Stage One gate: fits theme + reasonably applies PayPal + AI.
- [ ] One Grand + at most one Sponsor targeted (no stacking assumed).
- [ ] IP: team owns the submission or has rights; third-party assets licensed.
- [ ] Availability Dec 1–15 for judging; representative reachable ~Dec 21.

## Pre-submit verification (day before)

- [ ] `npm ci && npm run typecheck && npm test && npm run build` green
      on a clean checkout (Linux/CI).
- [ ] `docs/RELEASE_GATE.md` all green with no inflated PASS.
- [ ] Click every README/Devpost link from an incognito window.
- [ ] Re-run the flagship on the hosted URL; confirm `chainValid: true`.
