# Session Isolation & Concurrency Report

Date: 2026-11-09. Code: `c4299fa`. Status: measured, with documented limits.

## 1. Current architecture (as built, not as wished)

- Single-node JSON snapshot store (`data/afterpact.json` + `.bak`), atomic
  writes, hash-chained audit (`appAudit`).
- Demo runs are created anonymously; **resetting a run requires the
  per-run reset token** issued at creation (kept in the creator's browser
  only). Global reset requires the operator token (401-gated).
- **Known limitation: global lists are shared.** All visitors see the same
  demo-run list and audit trail. A visitor cannot delete or reset another
  visitor's run without its token, but they can see it. Full per-session
  scoping is NOT implemented — deliberately deferred as too risky
  pre-deadline (see TITAN III persistence decision).
- No tenant-isolation claim is made anywhere in the submission.

## 2. Concurrency probe (measured 2026-11-09)

25 concurrent `POST /api/demo/run` (flagship) against a local build of
`c4299fa` (`AFTERPACT_DATA_DIR=:memory:`):

| Metric | Observed |
|---|---|
| Completed / failed | 25 / 0 |
| Unique run ids | 25 / 25 (no duplicates) |
| Wall time | 117 ms |
| Latency p50 / p95 / max | 78 / 107 / 110 ms |
| Audit chain after burst | VALID, 300 entries |
| Cross-run interference | none observed |

Honest scope: this is a **local burst probe**, not a production load test
(1 vCPU VPS, file-backed store, real network). It proves the request path
has no shared-mutable-state crash or duplicate-operation bug under a
25-way burst. It does not prove 25-judge UX isolation (see §1).

## 3. Backup + restore drill (measured 2026-11-09)

- Pre-deploy backup `/root/afterpact-backup-20261109-c4299fa.tgz`,
  sha256 `7d2986f8…e6485`.
- Drill: `tar -tzf` lists cleanly; extracted to `/tmp/restore-check`;
  `data/afterpact.json` parses; all 15 store keys present
  (`version…demoRuns`); `appAudit` = 25 entries; promises + demoRuns present.
- Honest scope: proves the backup is **complete and restorable as data**.
  Not a production failover rehearsal (no cutover performed, by design —
  the live demo was never interrupted).

## 4. Residual risks for the judging window

1. Shared run/audit lists: judges see each other's demo activity (cosmetic,
   documented in `JUDGE_MODE_GUIDE.md`).
2. Snapshot store: single-node only; concurrent file writes serialize in
   Node's event loop (safe for judge-scale traffic, not enterprise-scale).
3. No rate-limit numbers are quoted here (not re-measured this mission);
   abuse boundaries are the run cap + token gates + operator kill switch.

## 5. Post-judging recommendation (not committed)

Per-session scoping or SQLite migration only after the submission lock,
behind the same backup → migrate → rollback-tested procedure, with the
25-session probe re-run against the new store.
