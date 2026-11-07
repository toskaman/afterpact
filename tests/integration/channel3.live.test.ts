import { describe, expect, it } from "vitest";
import {
  Channel3Client,
  channel3ConfigFromEnv,
} from "../../apps/api/src/channel3";

/**
 * Live Channel3 probe. Runs ONLY when CHANNEL3_API_KEY is present;
 * otherwise the suite skips cleanly with no failure. Performs exactly ONE
 * search (minimal credit spend) and asserts the normalized shape without
 * snapshotting volatile catalog data.
 */
const { config } = channel3ConfigFromEnv(process.env);
const LIVE =
  config.apiKey !== "" && process.env["CHANNEL3_LIVE_TEST"] !== "0";
const describeLive = LIVE ? describe : describe.skip;

describeLive("channel3 live discovery", () => {
  it(
    "one keyed search returns normalized candidates with attribution",
    async () => {
      const client = new Channel3Client(config);
      expect(client.status.configured).toBe(true);
      expect(client.status.mode).toBe("live");

      const result = await client.searchProducts({
        query: "mechanical keyboard",
        limit: 3,
      });
      expect(result.meta.origin).toBe("channel3-live");
      expect(result.meta.query).toBe("mechanical keyboard");
      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      for (const c of result.candidates) {
        expect(typeof c.productId).toBe("string");
        expect(c.productId.length).toBeGreaterThan(0);
        expect(typeof c.title).toBe("string");
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.attribution.source).toBe("channel3");
        expect(c.attribution.productId).toBe(c.productId);
        expect(c.attribution.query).toBe("mechanical keyboard");
        expect(typeof c.attribution.checkoutNote).toBe("string");
        expect(c.attribution.checkoutNote.length).toBeGreaterThan(0);
        expect(Array.isArray(c.offers)).toBe(true);
        expect(c.offerCount).toBe(c.offers.length);
        for (const o of c.offers) {
          expect(typeof o.merchant).toBe("string");
          expect(o.merchant.length).toBeGreaterThan(0);
        }
      }
    },
    60_000,
  );
});
