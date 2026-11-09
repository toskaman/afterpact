# Judge-window ops (Dec 1–15, 2026): keep the demo alive

Owner-facing runbook. No paid monitoring, no new services, no secrets in
this file. Current deploy: `c4299fa` on the Vultr box behind
`https://199.247.9.188.nip.io` (TITAN VI redeploy decision at merge time;
this file follows the NEW build SHA then).

## Twice-weekly 5-minute check (owner or agent with SSH)

1. Health: `curl -s https://199.247.9.188.nip.io/api/health` → expect
   `{"status":"ok", ...}` with the recorded build SHA.
2. Config: `/api/config` → `transport` is `mock-simulated`, no keys.
3. Flagship smoke (read-only walkthrough): open `#/judge`, run Scenario 1,
   confirm `completed` + Twin/Recorder links render.
4. Chain: open `#/recorder`, confirm `CHAIN VALID`.
5. Disk/process: `ssh` → `df -h /` (>20% free), `systemctl is-active
   afterpact` (or the recorded process supervisor), no error flood in the
   last 50 log lines.

## Backup (before ANY deploy or risky change)

- `ssh` → tar the data dir + app dir to
  `/root/afterpact-backup-YYYYMMDD-<sha>.tgz`, record `sha256sum`.
- Verify: list the archive, parse `afterpact.json`, confirm `appAudit`
  non-empty (procedure proven in TITAN V restore drill).
- Keep the last 2 backups; delete older to protect disk.

## Restart (demo down, box up)

1. Pull/verify the deployed SHA matches the recorded release SHA.
2. Restart the service via the supervisor (never `kill -9` the data dir).
3. Re-run the 5-minute check; if the chain shows INVALID, stop and
   restore from backup instead of writing new state.

## Rollback (bad deploy)

1. Stop the service, restore the pre-deploy backup archive + prior build.
2. Restart, re-run the 5-minute check, record the rollback in
   `docs/hackathon/POST_SUBMISSION_CHANGELOG.md`.
3. Never rewrite Git history or move the submission tag to "fix" a deploy.

## What NOT to do during judging

- No feature deploys, no dependency upgrades, no OS reboots without cause.
- No credential installs on the demo box (stays keyless by design).
- No Devpost/description/video edits after the deadline without explicit
  organizer authorization (recorded in the changelog if granted).
- No decommission before Dec 16, 2026.
