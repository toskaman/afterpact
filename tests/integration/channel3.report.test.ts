import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Committed Channel3 live-search artifact. Recorded by a keyed call to
 * POST https://api.trychannel3.com/v1/search; only public catalog
 * fields are stored (no API key, no raw payloads).
 */
describe("channel3 live report artifact", () => {
  const path = join(REPO_ROOT, "docs", "sponsors", "channel3-live-report.json");

  it("pins a real keyed search execution", () => {
    expect(existsSync(path)).toBe(true);
    const report = JSON.parse(readFileSync(path, "utf8"));
    expect(report.origin).toBe("channel3-live");
    expect(report.endpoint).toBe("POST https://api.trychannel3.com/v1/search");
    expect(report.candidateCount).toBeGreaterThan(0);
    expect(report.candidates.length).toBe(report.candidateCount);
    for (const candidate of report.candidates) {
      expect(typeof candidate.productId).toBe("string");
      expect(typeof candidate.title).toBe("string");
      expect(candidate.attributionSource).toBe("channel3");
      expect(candidate.hasCheckoutNote).toBe(true);
    }
    expect(report.keyRedacted).toBe(true);
    expect(report).not.toHaveProperty("apiKey");
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toMatch(/x-api-key|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9]{16,}/i);
  });
});
