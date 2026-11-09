import { describe, expect, it } from "vitest";
import {
  checkChannel3Grade,
  checkLineage,
  checkRequiredMarkers,
  checkStalePatterns,
  checkTestCounts,
  checkWording,
  COUNT_DOCS,
  isDocsOnlyPath,
} from "../../scripts/drift-lib.mjs";

/**
 * Drift-gate validators: stale phrases stay banned, canonical numbers stay
 * consistent with the manifest, and wording claims stay inside the honest
 * posture. Fixtures use synthetic canonical numbers on purpose — the point
 * is agreement with the manifest, not any particular count.
 */

const MANIFEST: any = {
  suite: { passed: 299, failed: 0, skipped: 33 },
  e2e: { passed: 12, total: 12 },
  statics: {
    newman: { requestsExecuted: 37, requestsFailed: 0, assertions: 18, assertionsFailed: 0 },
  },
  channel3Live: { grade: "artifact" },
  agStudioTrial: { keyInstalled: false, consent: "drafted-not-sent", judgingWindowCovered: "unknown" },
  video: { url: null, status: "file-built-upload-pending-owner" },
  devpost: { status: "draft-not-submitted" },
};

function reader(files: Record<string, string>): (rel: string) => string | null {
  return (rel: string) => files[rel] ?? null;
}

function cleanCounts(): Record<string, string> {
  const body = [
    "npm test # everything: 299 passed, 33 skipped keyless (manifest-verified)",
    "299 automated tests green (+33 keyless skips), 12 Playwright E2E green.",
    "Playwright E2E 12/12 in CI; Newman 37/37 requests, 18/18 assertions.",
    "Newman 37/37+18/18; per-file counts stay local: 17 tests in paypal.safety, 11 tests in policy.",
  ].join("\n");
  return Object.fromEntries(COUNT_DOCS.map((d) => [d, body]));
}

describe("drift: test-count consistency", () => {
  it("accepts docs that agree with the manifest", () => {
    expect(checkTestCounts(MANIFEST, reader(cleanCounts()))).toEqual([]);
  });

  it("rejects each stale-count phrasing observed in the wild", () => {
    const stale: Record<string, string> = {
      "README.md": "npm test # everything: 281 passed, 33 skipped keyless",
      "docs/demo/DEVPOST_DRAFT.md": "299 automated tests green (+33 keyless skips), 7 Playwright E2E green.",
      "docs/hackathon/JURY_EVIDENCE_MATRIX.md": "vitest run → 299 passed, 33 skipped; Playwright E2E 6/6 in CI.",
      "docs/hackathon/OWNER_SUBMISSION_CHECKLIST.md": "numbers verified: 299 tests, 7 E2E, Newman 37/37+18/18.",
    };
    const failures = checkTestCounts(MANIFEST, reader(stale));
    expect(failures.join("\n")).toContain("281 passed, manifest suite.passed=299");
    expect(failures.join("\n")).toContain("7 E2E, manifest e2e.total=12");
    expect(failures.join("\n")).toContain("E2E 6/6, manifest e2e=12/12");
    expect(failures).toHaveLength(4);
  });

  it("rejects stale Newman numbers", () => {
    const files = cleanCounts();
    files["README.md"] = "Newman execution verified: 36/37 requests, 18/18 assertions.";
    const failures = checkTestCounts(MANIFEST, reader(files));
    expect(failures.join("\n")).toContain("Newman 36/37 requests");
  });

  it("flags missing governed docs", () => {
    const failures = checkTestCounts(MANIFEST, reader({}));
    expect(failures).toHaveLength(COUNT_DOCS.length);
  });
});

describe("drift: wording posture", () => {
  it("rejects absolute live-money denials in the Devpost draft", () => {
    const failures = checkWording(MANIFEST, reader({
      "docs/demo/DEVPOST_DRAFT.md": "No live-money code paths exist.\nThe sandbox-only PayPal client handles all flows.",
    }));
    expect(failures).toHaveLength(2);
    expect(failures.join("\n")).toContain("absolutely denies live-money");
    expect(failures.join("\n")).toContain("sandbox-only");
  });

  it("rejects isolation claims but allows honest limitation prose", () => {
    const bad = checkWording(MANIFEST, reader({
      "README.md": "Every judge enjoys full per-session isolation and tenant isolation.",
    }));
    expect(bad.length).toBeGreaterThanOrEqual(2);
    const good = checkWording(MANIFEST, reader({
      "docs/security/SESSION_ISOLATION_REPORT.md": [
        "Full per-session scoping is NOT implemented — deliberately deferred.",
        "No tenant-isolation claim is made anywhere in the submission.",
      ].join("\n"),
    }));
    expect(good).toEqual([]);
  });

  it("rejects completed-usability claims but allows the protocol framing", () => {
    const bad = checkWording(MANIFEST, reader({
      "docs/demo/DEVPOST_DRAFT.md": "We completed 5 usability sessions and user feedback confirms the design.",
    }));
    expect(bad.length).toBeGreaterThanOrEqual(1);
    const good = checkWording(MANIFEST, reader({
      "docs/demo/DEVPOST_DRAFT.md": [
        "The lab-study package is ready for independent participants.",
        "Zero sessions run; timings are NOT measured human timings.",
      ].join("\n"),
    }));
    expect(good).toEqual([]);
  });

  it("rejects mock-as-live narration without a Sandbox marker", () => {
    const bad = checkWording(MANIFEST, reader({
      "README.md": "The demo shows a live PayPal payment executed end to end.",
    }));
    expect(bad).toHaveLength(1);
    const good = checkWording(MANIFEST, reader({
      "README.md": "Real sandbox loop: the live PayPal Sandbox refund executed and verified.",
    }));
    expect(good).toEqual([]);
  });

  it("rejects Studio trial claims against the pending manifest posture", () => {
    const failures = checkWording(MANIFEST, reader({
      "docs/sponsors/AG_GRID_STATUS.md": [
        "The trial key is installed on the box.",
        "AG Grid consent granted last week; judging-window covered.",
      ].join("\n"),
    }));
    expect(failures).toHaveLength(3);
  });

  it("rejects submission/video claims while the manifest says pending", () => {
    const failures = checkWording(MANIFEST, reader({
      "docs/hackathon/OWNER_SUBMISSION_CHECKLIST.md": [
        "Watch: https://www.youtube.com/watch?v=dQw4w9WgXcQ for the final cut.",
        "Devpost submission confirmed yesterday.",
      ].join("\n"),
    }));
    expect(failures).toHaveLength(2);
    const good = checkWording(MANIFEST, reader({
      "docs/demo/DEVPOST_DRAFT.md": "Demo video (<3 min): TBD:youtube-url (owner uploads, then replaces this marker).",
    }));
    expect(good).toEqual([]);
  });
});

describe("drift: stale patterns, markers, channel3", () => {
  it("still bans legacy stale phrases and requires live-truth markers", () => {
    expect(checkStalePatterns(reader({ "README.md": "No LLM inference runs in this build" })).join("\n")).toContain("denies runtime AI");
    expect(checkRequiredMarkers(reader({ "README.md": "no manifest mention" })).join("\n")).toContain("cites the evidence manifest");
  });

  it("polices channel3 grade honesty only below artifact", () => {
    const docs = reader({ "docs/hackathon/JURY_EVIDENCE_MATRIX.md": "channel3 search executed live and green" });
    expect(checkChannel3Grade(MANIFEST, docs)).toEqual([]);
    expect(checkChannel3Grade({ ...MANIFEST, channel3Live: { grade: "asserted" } }, docs)).toHaveLength(1);
  });
});

describe("drift: manifest lineage", () => {
  it("accepts HEAD-equal and docs-only descendants", () => {
    const base = { verifiedCommit: "a504c23", headSha: "5b098bb", isAncestor: true, gitAvailable: true };
    expect(checkLineage({ ...base, changedFiles: [] })).toEqual([]);
    expect(checkLineage({ ...base, changedFiles: ["docs/demo/X.md", "README.md", "brag-output/f.mp4"] })).toEqual([]);
  });

  it("rejects code drift and non-ancestor commits", () => {
    const base = { verifiedCommit: "a504c23", headSha: "5b098bb", isAncestor: true, gitAvailable: true };
    const code = checkLineage({ ...base, changedFiles: ["docs/a.md", "apps/api/src/demo.ts"] });
    expect(code.join("\n")).toContain("apps/api/src/demo.ts");
    const stale = checkLineage({ ...base, isAncestor: false, changedFiles: [] });
    expect(stale.join("\n")).toContain("not an ancestor");
    expect(checkLineage({ ...base, verifiedCommit: "xyz" })).toHaveLength(1);
    expect(checkLineage({ ...base, gitAvailable: false })).toEqual([]);
  });

  it("classifies docs-only paths", () => {
    expect(isDocsOnlyPath("docs/hackathon/X.md")).toBe(true);
    expect(isDocsOnlyPath("README.md")).toBe(true);
    expect(isDocsOnlyPath("brag-output/f.mp4")).toBe(true);
    expect(isDocsOnlyPath("apps/api/src/demo.ts")).toBe(false);
    expect(isDocsOnlyPath("scripts/check-docs-drift.mjs")).toBe(false);
    expect(isDocsOnlyPath(".github/workflows/ci.yml")).toBe(false);
  });
});
