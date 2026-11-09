/* Pure validators for scripts/check-docs-drift.mjs (no fs/git access).
 *
 * Every function takes already-read content and returns failure strings
 * (empty = clean), so the same logic runs in CI and in unit tests.
 * Numeric checks are manifest-driven: docs must agree with the manifest's
 * canonical numbers, whatever they currently are.
 */
"use strict";

/** Live docs whose test-count claims must match the manifest. Historical
 * TITAN/OMEGA reports are intentionally NOT governed (frozen in time). */
export const COUNT_DOCS = [
  "README.md",
  "docs/demo/DEVPOST_DRAFT.md",
  "docs/hackathon/JURY_EVIDENCE_MATRIX.md",
  "docs/hackathon/OWNER_SUBMISSION_CHECKLIST.md",
];

/** Live docs scanned for wording claims (isolation, usability, live-mode). */
export const WORDING_DOCS = [
  ...COUNT_DOCS,
  "docs/demo/JUDGE_MODE_GUIDE.md",
  "docs/security/SESSION_ISOLATION_REPORT.md",
  "docs/sponsors/AG_GRID_STATUS.md",
  "docs/sponsors/ag-studio-trial.md",
];

// ---------------------------------------------------------------------------
// 1. Known-stale claim patterns (exact legacy phrases that must never return)
// ---------------------------------------------------------------------------

/** [files, regex source, flags, why]. Sources (not RegExp) so tests can inspect them. */
export const BANNED = [
  [["README.md"], "No LLM inference runs in this build", "", "README denies runtime AI"],
  [["README.md"], "155 (passing )?tests|156 tests", "", "README stale test count"],
  [["README.md"], "5 projects", "", "README stale typecheck count (6 projects)"],
  [["README.md"], "deploy is a human step", "i", "README claims deploy is a human step (Vultr live)"],
  [["docs/RELEASE_GATE.md"], "15[56] (passing )?tests", "", "RELEASE_GATE stale test count"],
  [["docs/RELEASE_GATE.md"], "AG Studio explicitly NOT claimed", "", "RELEASE_GATE denies Studio usage"],
  [["docs/RELEASE_GATE.md"], "_NONE_ redistributed|no proprietary\\/trial binaries", "i", "RELEASE_GATE denies trial binaries"],
  [["docs/RELEASE_GATE.md"], "No git repo initialized yet", "", "RELEASE_GATE predates the repo"],
  [["docs/RELEASE_GATE.md"], "never run on GitHub yet", "", "RELEASE_GATE predates CI"],
  [["docs/RELEASE_GATE.md"], "apply (the )?Render Blueprint", "i", "RELEASE_GATE Render deploy step"],
  [["docs/demo/DEVPOST_DRAFT.md"], "15[56] (passing )?tests", "", "DEVPOST stale test count"],
  [["docs/demo/DEVPOST_DRAFT.md"], "Verify the live-sandbox flagship", "", "DEVPOST stale what's-next (flagship verified)"],
  [["docs/demo/DEVPOST_DRAFT.md"], "AG Studio not in (this )?build", "i", "DEVPOST denies Studio usage"],
  [["docs/demo/DEVPOST_DRAFT.md"], "hosted deploy is a human step", "i", "DEVPOST predates Vultr hosting"],
  [["docs/demo/DEVPOST_DRAFT.md"], "apply the Render Blueprint", "i", "DEVPOST Render deploy step"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], "15[56] (passing )?tests", "", "JURY stale test count"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], "no stochastic LLM evals to reproduce", "i", "JURY denies LLM evals"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], "22 tests in policy", "", "JURY wrong policy count (11)"],
  [["docs/hackathon/JURY_EVIDENCE_MATRIX.md"], "never run on GitHub yet", "", "JURY predates CI"],
  [["docs/demo/DEMO_SCRIPT.md"], "open the Render URL", "i", "DEMO_SCRIPT Render URL"],
  [["docs/demo/FRONTEND_DEMO_GUIDE.md"], "no Playwright in this repo", "i", "FRONTEND guide denies Playwright"],
  [["docs/sponsors/AG_STUDIO_UPGRADE_PATH.md"], "NOT IMPLEMENTED, nothing claimed as done", "i", "UPGRADE_PATH stale header"],
  [["docs/sponsors/CHANNEL3_INTEGRATION.md"], "set the key on the Render service", "i", "CHANNEL3 Render service ref"],
];

/** RENDER_DEPLOYMENT must NOT start with the old title (inverted check). */
export const RENDER_DOC = "docs/sponsors/RENDER_DEPLOYMENT.md";
export const RENDER_OLD_TITLE = "^# AFTERPACT on Render";

/** [file, regex source, flags, why]. */
export const REQUIRED = [
  ["README.md", "RELEASE_EVIDENCE_MANIFEST", "", "README cites the evidence manifest"],
  ["README.md", "copyright 2015-2026 by AG Grid Ltd", "", "README carries Studio attribution"],
  ["LICENSE", "THIRD-PARTY CARVE-OUT", "", "LICENSE carries the commercial carve-out"],
  ["docs/sponsors/ag-studio-trial.md", "consent request", "i", "trial doc holds the consent draft"],
  ["docs/sponsors/AG_GRID_STATUS.md", "No redistribution", "", "AG Grid status states no-redistribution"],
  ["docs/demo/DEVPOST_DRAFT.md", "AI tools used", "i", "DEVPOST lists AI tools used"],
  ["README.md", "PAYPAL_ALLOW_LIVE", "", "README documents the gated live-mode config"],
];

/**
 * @param {(rel: string) => string | null} read file reader (null = missing)
 */
export function checkStalePatterns(read) {
  const failures = [];
  for (const [files, source, flags, why] of BANNED) {
    const pattern = new RegExp(source, flags);
    for (const file of files) {
      const content = read(file);
      if (content === null) {
        failures.push(`governed doc missing: ${file}`);
        continue;
      }
      if (pattern.test(content)) failures.push(`${why} (${file})`);
    }
  }
  const renderDoc = read(RENDER_DOC);
  if (renderDoc === null) {
    failures.push(`governed doc missing: ${RENDER_DOC}`);
  } else if (new RegExp(RENDER_OLD_TITLE, "m").test(renderDoc)) {
    failures.push(`RENDER doc lacks redirect header (${RENDER_DOC})`);
  }
  return failures;
}

/** @param {(rel: string) => string | null} read */
export function checkRequiredMarkers(read) {
  const failures = [];
  for (const [file, source, flags, why] of REQUIRED) {
    const content = read(file);
    if (content === null) {
      failures.push(`governed doc missing: ${file}`);
      continue;
    }
    if (!new RegExp(source, flags).test(content)) failures.push(`missing: ${why} (${file})`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// 2. Channel3 grade honesty (unchanged semantics)
// ---------------------------------------------------------------------------

/** @param {any} manifest @param {(rel: string) => string | null} read */
export function checkChannel3Grade(manifest, read) {
  const failures = [];
  if (manifest.channel3Live?.grade !== "artifact") {
    for (const file of ["docs/hackathon/JURY_EVIDENCE_MATRIX.md", "docs/audit/100_QUESTIONS.md"]) {
      const content = read(file);
      if (content === null) continue;
      for (const line of content.split("\n")) {
        if (!/channel3/i.test(line)) continue;
        if (/NOT VERIFIED|retract|WITHOUT a committed|pending/i.test(line)) continue;
        if (/\bexecuted live\b|\blive\b[^.\n]{0,60}\bgreen\b/i.test(line)) {
          failures.push(`${file} claims live Channel3 execution but manifest grade is ${manifest.channel3Live?.grade}: ${line.trim().slice(0, 120)}`);
        }
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// 3. Manifest-driven numeric consistency
// ---------------------------------------------------------------------------

/**
 * Every test-count claim in the governed live docs must equal the manifest's
 * canonical numbers. Per-file counts ("17 tests in paypal.safety") are
 * ignored: only 3-4 digit totals and E2E/Newman forms are checked.
 * @param {any} manifest @param {(rel: string) => string | null} read
 */
export function checkTestCounts(manifest, read) {
  const failures = [];
  const suite = manifest.suite ?? {};
  const e2e = manifest.e2e ?? {};
  const newman = manifest.statics?.newman ?? {};
  const newmanTotal = (newman.requestsExecuted ?? 0) + (newman.requestsFailed ?? 0);

  for (const file of COUNT_DOCS) {
    const content = read(file);
    if (content === null) {
      failures.push(`governed doc missing: ${file}`);
      continue;
    }
    const at = (line) => `${file}:${line}`;
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/(\d{3,4})\s+passed/g)) {
        const value = Number(match[1]);
        if (value !== suite.passed) {
          failures.push(`${at(index + 1)} claims ${value} passed, manifest suite.passed=${suite.passed}`);
        }
      }
      for (const match of line.matchAll(/(\d{2,4})\s+skipped/g)) {
        const value = Number(match[1]);
        if (value !== suite.skipped) {
          failures.push(`${at(index + 1)} claims ${value} skipped, manifest suite.skipped=${suite.skipped}`);
        }
      }
      for (const match of line.matchAll(/\(\+(\d{2,4})\s+keyless skips?\)/g)) {
        const value = Number(match[1]);
        if (value !== suite.skipped) {
          failures.push(`${at(index + 1)} claims +${value} keyless skips, manifest suite.skipped=${suite.skipped}`);
        }
      }
      for (const match of line.matchAll(/(\d{3,4})\s+(automated\s+)?tests\b/g)) {
        const value = Number(match[1]);
        if (value !== suite.passed) {
          failures.push(`${at(index + 1)} claims ${value} tests, manifest suite.passed=${suite.passed}`);
        }
      }
      for (const match of line.matchAll(/(\d{1,3})\s+(Playwright\s+)?E2E\b/g)) {
        const value = Number(match[1]);
        if (value !== e2e.total) {
          failures.push(`${at(index + 1)} claims ${value} E2E, manifest e2e.total=${e2e.total}`);
        }
      }
      for (const match of line.matchAll(/E2E\s*:?\s*\(?(\d+)\s*\/\s*(\d+)/g)) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        if (a !== e2e.passed || b !== e2e.total) {
          failures.push(`${at(index + 1)} claims E2E ${a}/${b}, manifest e2e=${e2e.passed}/${e2e.total}`);
        }
      }
      for (const match of line.matchAll(/(\d+)\s*\/\s*(\d+)\s+(requests|executed)/g)) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        if (a !== newman.requestsExecuted || b !== newmanTotal) {
          failures.push(`${at(index + 1)} claims Newman ${a}/${b} ${match[3]}, manifest newman=${newman.requestsExecuted}/${newmanTotal}`);
        }
      }
      for (const match of line.matchAll(/(\d+)\s*\/\s*(\d+)\s+assertions/g)) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        const total = (newman.assertions ?? 0);
        if (a !== total || b !== total) {
          failures.push(`${at(index + 1)} claims Newman assertions ${a}/${b}, manifest assertions=${total}/${total}`);
        }
      }
      for (const match of line.matchAll(/Newman[^\n]{0,60}?(\d+)\s*\/\s*(\d+)\s*\+\s*(\d+)\s*\/\s*(\d+)/g)) {
        const [, r1, r2, a1, a2] = match.map(Number);
        const total = newman.assertions ?? 0;
        if (r1 !== newman.requestsExecuted || r2 !== newmanTotal || a1 !== total || a2 !== total) {
          failures.push(`${at(index + 1)} claims Newman ${r1}/${r2}+${a1}/${a2}, manifest newman=${newman.requestsExecuted}/${newmanTotal}+${total}/${total}`);
        }
      }
    });
  }
  return failures;
}

// ---------------------------------------------------------------------------
// 4. Wording claims (line-scoped, with honest-context allowlists)
// ---------------------------------------------------------------------------

/**
 * @param {any} manifest @param {(rel: string) => string | null} read
 */
export function checkWording(manifest, read) {
  const failures = [];
  const trial = manifest.agStudioTrial ?? {};
  const videoUrl = manifest.video?.url ?? null;
  const devpostSubmitted = /^(submitted|accepted|live)\b/.test(manifest.devpost?.status ?? "");

  for (const file of WORDING_DOCS) {
    const content = read(file);
    if (content === null) continue; // missing-file policed by the stale/marker checks
    content.split("\n").forEach((line, index) => {
      const at = `${file}:${index + 1}`;
      const clip = line.trim().slice(0, 140);

      // (a) Absolute live-money denial contradicts the gated live config.
      if (file === "docs/demo/DEVPOST_DRAFT.md") {
        if (/no live-money (code paths|mode|operations?)(\s+exist)?/i.test(line)) {
          failures.push(`${at} absolutely denies live-money paths; README documents the gated config (PAYPAL_MODE=live + PAYPAL_ALLOW_LIVE=true): ${clip}`);
        }
        if (/sandbox-only PayPal client/i.test(line)) {
          failures.push(`${at} calls the client sandbox-only; live mode is gated-but-present: ${clip}`);
        }
      }

      // (b) Session/tenant isolation must never be claimed as done.
      if (/per-session (isolation|scoping|data isolation)/i.test(line) &&
        !/NOT |not |no |without|deferred|too (risky|invasive)|after the submission|honest fallback|fails the build|wording|rewrite|recommendation|future work/i.test(line)) {
        failures.push(`${at} reads as a per-session isolation claim (none implemented): ${clip}`);
      }
      if (/tenant[ -]isolation/i.test(line) &&
        !/no |NOT |without|honest|claim is made|fails|rewrite|against|not /i.test(line)) {
        failures.push(`${at} reads as a tenant-isolation claim (none implemented): ${clip}`);
      }

      // (c) Human usability testing must never be presented as completed.
      if (/((usability|user) (sessions?|tests?|testing) (was|were|has been|have been|are) (completed|conducted|run|done|finished))|(completed|conducted|ran) \d+ (usability|user) (sessions?|tests?)|(usability|user) (results|feedback) (show|shows|confirm|proves?)/i.test(line) &&
        !/NOT |no |zero|pending|owner|protocol|ready|required|recruit|example|stand between|needed/i.test(line)) {
        failures.push(`${at} presents usability testing as completed (zero sessions run): ${clip}`);
      }

      // (d) Mock transport must never be narrated as live execution.
      if (/live (PayPal )?(payment|transaction|refund|order|purchase|money|capture)(s)? (executed|completed|succeeded|processed|performed|happened)/i.test(line) &&
        !/sandbox/i.test(line)) {
        failures.push(`${at} narrates live execution without a Sandbox marker (mock-as-live risk): ${clip}`);
      }

      // (e) AG Studio trial status must match the manifest posture.
      if (trial.keyInstalled !== true &&
        /(trial|license) key (is |has been )?(installed|active|live|in place|configured on the box)/i.test(line)) {
        failures.push(`${at} claims a Studio key installed (manifest keyInstalled=${trial.keyInstalled}): ${clip}`);
      }
      if (!/granted|approved|confirmed|obtained/.test(trial.consent ?? "") &&
        /consent (granted|received|approved|confirmed|obtained)/i.test(line)) {
        failures.push(`${at} claims Studio consent resolved (manifest consent=${trial.consent}): ${clip}`);
      }
      if (!/covered|confirmed/.test(trial.judgingWindowCovered ?? "") &&
        /judging[ -]?window (covered|confirmed|approved|secured)/i.test(line)) {
        failures.push(`${at} claims judging-window coverage (manifest judgingWindowCovered=${trial.judgingWindowCovered}): ${clip}`);
      }

      // (f) Submission/video status must match the manifest posture.
      if (videoUrl === null && /youtube\.com\/watch\?v=|youtu\.be\//i.test(line) &&
        !/placeholder|pending|owner|TBD|example|not yet|replaces this marker/i.test(line)) {
        failures.push(`${at} shows a YouTube URL while manifest video.url is null: ${clip}`);
      }
      if (!devpostSubmitted && /Devpost (submission |entry )?(confirmed|complete|completed|live|accepted|submitted successfully)/i.test(line)) {
        failures.push(`${at} presents Devpost as submitted (manifest devpost.status=${manifest.devpost?.status}): ${clip}`);
      }
    });
  }
  return failures;
}

// ---------------------------------------------------------------------------
// 5. Manifest lineage: verifiedCommit must be HEAD or docs-only behind it
// ---------------------------------------------------------------------------

/** Paths that may change after verifiedCommit without invalidating the suite. */
export function isDocsOnlyPath(path) {
  return path.startsWith("docs/") || path.endsWith(".md") || path.startsWith("brag-output/");
}

/**
 * @param {{ verifiedCommit: string, headSha: string, isAncestor: boolean,
 *   changedFiles: string[], gitAvailable: boolean }} input
 */
export function checkLineage(input) {
  const failures = [];
  if (!input.gitAvailable) return failures; // caller logs the skip
  if (!/^[0-9a-f]{7,40}$/i.test(input.verifiedCommit ?? "")) {
    failures.push(`manifest verifiedCommit is not a SHA: ${input.verifiedCommit}`);
    return failures;
  }
  if (!input.isAncestor) {
    failures.push(`manifest verifiedCommit ${input.verifiedCommit} is not an ancestor of HEAD ${input.headSha}; re-run the suite and regen the manifest on current HEAD`);
    return failures;
  }
  const code = (input.changedFiles ?? []).filter((f) => !isDocsOnlyPath(f));
  if (code.length > 0) {
    const shown = code.slice(0, 10).join(", ");
    failures.push(`code changed since manifest verifiedCommit ${input.verifiedCommit} (${shown}${code.length > 10 ? ` +${code.length - 10} more` : ""}); re-run the suite and regen the manifest`);
  }
  return failures;
}
