import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";
import {
  Channel3Client,
  Channel3Error,
  Channel3NotConfiguredError,
  channel3ConfigFromEnv,
  compareCandidates,
  normalizeAvailability,
  normalizePrice,
  type DiscoveryCandidate,
  type FetchLike,
} from "../../apps/api/src/channel3";

/**
 * Channel3 discovery: normalization, comparison, attribution, and failure
 * isolation. Live HTTP is stubbed at the fetch boundary (never fabricated
 * availability: unknown prices/availabilities stay explicitly unknown).
 */

const WEB_DIR = join(__dirname, "..", "..", "apps", "web", "public");

function stubFetch(handler: (url: string) => unknown): FetchLike {
  return async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => handler(url) as unknown,
    text: async () => JSON.stringify(handler(url)),
  });
}

function stubFailure(status: number, body: string): FetchLike {
  return async () => ({
    ok: false,
    status,
    json: async () => ({}) as unknown,
    text: async () => body,
  });
}

const WIRED_PRODUCT = {
  id: "prod_abc123",
  title: "Field sensor kit (3-pack)",
  brand: "Acme",
  image_url: "https://cdn.example.com/kit.jpg",
  url: "https://shop.example.com/kit",
  offers: [
    { domain: "acme.example.com", price: "$129.99", availability: "in_stock", buy_url: "https://acme.example.com/buy/1" },
    { merchant: "Northwind", price: { price: "134.99", currency: "USD" }, availability: "out_of_stock", url: "https://northwind.example.com/kit" },
    { domain: "mystery.example.com" },
  ],
};

function testClient(fetchImpl: FetchLike): Channel3Client {
  return new Channel3Client(
    { apiKey: "test-key", baseUrl: "https://api.trychannel3.com", country: "US", currency: "USD", language: "en", timeoutMs: 5000 },
    fetchImpl,
  );
}

async function rejectsChannel3(promise: Promise<unknown>): Promise<Channel3Error> {
  try {
    await promise;
  } catch (error) {
    return error as Channel3Error;
  }
  throw new Error("expected a Channel3Error rejection");
}

describe("price + availability normalization", () => {
  it("parses dollar strings to minor units", () => {
    expect(normalizePrice("$129.99", "USD")).toMatchObject({ priceMinor: 12999, currency: "USD" });
    expect(normalizePrice("$1,299.99", "USD")).toMatchObject({ priceMinor: 129999 });
  });

  it("parses decimal-comma renderings", () => {
    expect(normalizePrice("1.299,99 €", "EUR")).toMatchObject({ priceMinor: 129999, currency: "EUR" });
  });

  it("parses major-unit numbers and price objects", () => {
    expect(normalizePrice(12.5, "USD")).toMatchObject({ priceMinor: 1250 });
    expect(normalizePrice({ price: "134.99", currency: "usd" }, "USD")).toMatchObject({ priceMinor: 13499, currency: "USD" });
    expect(normalizePrice({ cents: 4999, currency: "USD" }, "USD")).toMatchObject({ priceMinor: 4999 });
  });

  it("keeps garbage prices explicitly unknown", () => {
    expect(normalizePrice("call for price", "USD").priceMinor).toBeNull();
    expect(normalizePrice(null, "USD").priceMinor).toBeNull();
    expect(normalizePrice(-5, "USD").priceMinor).toBeNull();
  });

  it("normalizes availability without ever defaulting to in-stock", () => {
    expect(normalizeAvailability(true).availability).toBe("in_stock");
    expect(normalizeAvailability(false).availability).toBe("out_of_stock");
    expect(normalizeAvailability("In Stock").availability).toBe("in_stock");
    expect(normalizeAvailability("sold out").availability).toBe("out_of_stock");
    expect(normalizeAvailability("ships in 3 weeks").availability).toBe("unknown");
    expect(normalizeAvailability(undefined).availability).toBe("unknown");
    expect(normalizeAvailability(null).availability).toBe("unknown");
  });
});

describe("search + attribution", () => {
  it("normalizes products and attributes every candidate", async () => {
    const client = testClient(stubFetch(() => ({ products: [WIRED_PRODUCT] })));
    const result = await client.searchProducts({ query: "sensor kit", limit: 5 });
    expect(result.meta.origin).toBe("channel3-live");
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0] as DiscoveryCandidate;
    expect(candidate.productId).toBe("prod_abc123");
    expect(candidate.offers).toHaveLength(3);
    expect(candidate.offers[0]).toMatchObject({ merchant: "acme.example.com", priceMinor: 12999, availability: "in_stock" });
    expect(candidate.offers[2]).toMatchObject({ priceMinor: null, availability: "unknown" });
    expect(candidate.bestPriceMinor).toBe(12999);
    expect(candidate.pricedOfferCount).toBe(2);
    expect(candidate.attribution.source).toBe("channel3");
    expect(candidate.attribution.query).toBe("sensor kit");
    expect(candidate.attribution.checkoutNote).toContain("does not authorize checkout");
  });

  it("accepts paginated data/items aliases", async () => {
    const client = testClient(stubFetch(() => ({ data: [WIRED_PRODUCT] })));
    const result = await client.searchProducts({ query: "kit" });
    expect(result.candidates).toHaveLength(1);
  });

  it("sends the price ceiling as a major-unit filter", async () => {
    let seenBody = "";
    const client = testClient(async (_url: string, init) => {
      seenBody = String(init.body ?? "");
      return { ok: true, status: 200, json: async () => ({ products: [] }) as unknown, text: async () => "{}" };
    });
    await client.searchProducts({ query: "kit", maxPriceMinor: 10000 });
    expect(seenBody).toContain("max_price");
    expect(seenBody).toContain("100");
  });

  it("fetches product details and merchant-URL lookups", async () => {
    const client = testClient(stubFetch(() => ({ product: WIRED_PRODUCT })));
    const product = await client.getProduct("prod_abc123");
    expect(product.productId).toBe("prod_abc123");
    const lookup = await client.lookupUrl({ url: "https://shop.example.com/kit" });
    expect(lookup.title).toContain("sensor kit");
  });
});

describe("comparison", () => {
  function candidate(overrides: Partial<DiscoveryCandidate> & { productId: string; title: string }): DiscoveryCandidate {
    return {
      brand: null,
      imageUrl: null,
      url: null,
      offers: [],
      offerCount: 0,
      bestPriceMinor: null,
      bestPriceCurrency: null,
      pricedOfferCount: 0,
      inStockKnownCount: 0,
      unknownAvailabilityCount: 0,
      attribution: {
        source: "channel3",
        productId: overrides.productId,
        searchedAt: new Date().toISOString(),
        query: "q",
        locale: { country: "US", currency: "USD", language: "en" },
        checkoutNote: "Discovery only.",
      },
      ...overrides,
    } as DiscoveryCandidate;
  }

  it("ranks priced offers within each currency and isolates the unpriced", () => {
    const cheap = candidate({
      productId: "a",
      title: "A",
      offers: [{ merchant: "m1", domain: null, priceMinor: 5000, currency: "USD", priceRaw: "50", availability: "in_stock", availabilityRaw: "in_stock", url: null }],
    });
    const pricey = candidate({
      productId: "b",
      title: "B",
      offers: [{ merchant: "m2", domain: null, priceMinor: 9000, currency: "USD", priceRaw: "90", availability: "unknown", availabilityRaw: null, url: null }],
    });
    const euro = candidate({
      productId: "c",
      title: "C",
      offers: [{ merchant: "m3", domain: null, priceMinor: 4000, currency: "EUR", priceRaw: "40", availability: "in_stock", availabilityRaw: "in_stock", url: null }],
    });
    const unpriced = candidate({
      productId: "d",
      title: "D",
      offers: [{ merchant: "m4", domain: null, priceMinor: null, currency: null, priceRaw: null, availability: "unknown", availabilityRaw: null, url: null }],
      unknownAvailabilityCount: 1,
    });
    const result = compareCandidates([pricey, cheap, euro, unpriced]);
    expect(result.groups.map((g) => g.currency).sort()).toEqual(["EUR", "USD"]);
    const usd = result.groups.find((g) => g.currency === "USD");
    expect(usd?.rows.map((r) => r.candidate.productId)).toEqual(["a", "b"]);
    expect(result.unpriced.map((r) => r.candidate.productId)).toEqual(["d"]);
    expect(result.warnings.join(" ")).toContain("within each currency only");
  });
});

describe("failure isolation", () => {
  it("fails closed without an API key", async () => {
    const { config, status } = channel3ConfigFromEnv({ ...process.env, CHANNEL3_API_KEY: "" });
    expect(status.configured).toBe(false);
    expect(status.mode).toBe("unconfigured");
    const client = new Channel3Client(config, stubFetch(() => ({ products: [] })));
    await expect(client.searchProducts({ query: "kit" })).rejects.toBeInstanceOf(Channel3NotConfiguredError);
  });

  it("maps auth failures to non-retryable errors without leaking the key", async () => {
    const client = testClient(stubFailure(401, "bad key"));
    const error = await rejectsChannel3(client.searchProducts({ query: "kit" }));
    expect(error).toBeInstanceOf(Channel3Error);
    expect(error.code).toBe("channel3-auth");
    expect(error.retryable).toBe(false);
    expect(error.message).not.toContain("test-key");
  });

  it("marks rate limits and provider errors retryable", async () => {
    const limited = await rejectsChannel3(testClient(stubFailure(429, "slow down")).searchProducts({ query: "kit" }));
    expect(limited.code).toBe("channel3-rate-limited");
    expect(limited.retryable).toBe(true);
    const broken = await rejectsChannel3(testClient(stubFailure(503, "oops")).searchProducts({ query: "kit" }));
    expect(broken.code).toBe("channel3-provider");
    expect(broken.retryable).toBe(true);
  });

  it("maps network failures and bad payloads", async () => {
    const network = testClient(async () => {
      throw new Error("socket hangup");
    });
    const netError = await rejectsChannel3(network.searchProducts({ query: "kit" }));
    expect(netError.code).toBe("channel3-network");
    expect(netError.retryable).toBe(true);
    const badShape = await rejectsChannel3(testClient(stubFetch(() => "not-a-search-payload")).searchProducts({ query: "kit" }));
    expect(badShape.code).toBe("channel3-bad-response");
  });

  it("isolates per-product failures inside compare", async () => {
    const mixed = new Channel3Client(
      { apiKey: "k", baseUrl: "https://api.trychannel3.com", country: "US", currency: "USD", language: "en", timeoutMs: 5000 },
      async (url: string) => {
        if (url.includes("good")) {
          return { ok: true, status: 200, json: async () => ({ product: { ...WIRED_PRODUCT, id: "good" } }) as unknown, text: async () => "{}" };
        }
        return { ok: false, status: 404, json: async () => ({}) as unknown, text: async () => "missing" };
      },
    );
    const result = await mixed.compareProducts({ productIds: ["good", "bad"] });
    expect(result.failures.map((f) => f.productId)).toEqual(["bad"]);
    expect(result.comparison.groups.length).toBeGreaterThan(0);
  });
});

describe("discovery HTTP surface (unconfigured)", () => {
  let app: App;
  let base = "";

  beforeAll(async () => {
    app = createApp({
      dataDir: ":memory:",
      webDir: WEB_DIR,
      processEnv: { ...process.env, PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "", CHANNEL3_API_KEY: "", LOG_LEVEL: "silent" },
    });
    const port = await app.listen(0);
    base = `http://localhost:${port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("reports unconfigured status without key material", async () => {
    const res = await fetch(`${base}/api/discovery/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data["configured"]).toBe(false);
    expect(body.data["mode"]).toBe("unconfigured");
    expect(JSON.stringify(body)).not.toContain("CHANNEL3_API_KEY=");
  });

  it("returns 503 discovery-unavailable on search without a key", async () => {
    const res = await fetch(`${base}/api/discovery/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "sensor kit" }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("discovery-unavailable");
  });

  it("validates compare input before touching the provider", async () => {
    const res = await fetch(`${base}/api/discovery/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productIds: ["only-one"] }),
    });
    expect(res.status).toBe(422);
  });
});
