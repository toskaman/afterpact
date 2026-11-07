import { z } from "zod";
import {
  CurrencyCodeSchema,
  currencyDecimals,
} from "../../../packages/domain/src/index";

/**
 * Channel3 live product discovery (Engine B).
 *
 * Real HTTP client for the Channel3 universal product catalog:
 * base `https://api.trychannel3.com`, auth via `x-api-key` header,
 * `POST /v1/search` (+ `GET /v1/products/{id}`, `POST /v1/lookup`).
 * Shapes follow the official Channel3 API skill
 * (channel3-ai/skills: skills/channel3-api) and docs.trychannel3.com.
 *
 * Honesty rules (never fabricate availability or checkout):
 * - Unknown/missing price or availability normalizes to an explicit
 *   "unknown" state — never defaults to in-stock, never invents a price.
 * - Discovery results are NOT checkout authorization: a search hit does not
 *   imply the merchant is chargeable on our PayPal sandbox credentials.
 *   The authorized payment path stays on the sandbox merchant offer.
 * - Without CHANNEL3_API_KEY every search fails closed with
 *   Channel3NotConfiguredError (HTTP 503 `discovery-unavailable`).
 */

export const CHANNEL3_DEFAULT_BASE = "https://api.trychannel3.com";
export const CHANNEL3_DOCS_URL = "https://docs.trychannel3.com";

export interface Channel3Config {
  apiKey: string;
  baseUrl: string;
  country: string;
  currency: string;
  language: string;
  timeoutMs: number;
}

export interface Channel3Status {
  configured: boolean;
  mode: "live" | "unconfigured";
  baseUrl: string;
  country: string;
  currency: string;
  language: string;
  timeoutMs: number;
  /** Why the client is (un)configured. Never contains key material. */
  reason: string;
  docs: string;
}

export function channel3ConfigFromEnv(env: NodeJS.ProcessEnv): {
  configured: boolean;
  config: Channel3Config;
  status: Channel3Status;
} {
  const apiKey = (env["CHANNEL3_API_KEY"] ?? "").trim();
  const baseUrl = (env["CHANNEL3_API_BASE"] ?? CHANNEL3_DEFAULT_BASE).replace(/\/+$/, "");
  const country = (env["CHANNEL3_COUNTRY"] ?? "US").trim().toUpperCase() || "US";
  const currency = (env["CHANNEL3_CURRENCY"] ?? "USD").trim().toUpperCase() || "USD";
  const language = (env["CHANNEL3_LANGUAGE"] ?? "en").trim().toLowerCase() || "en";
  const timeoutRaw = Number.parseInt(env["CHANNEL3_TIMEOUT_MS"] ?? "15000", 10);
  const timeoutMs = Number.isSafeInteger(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000;
  const config: Channel3Config = { apiKey, baseUrl, country, currency, language, timeoutMs };
  const configured = apiKey !== "";
  return {
    configured,
    config,
    status: {
      configured,
      mode: configured ? "live" : "unconfigured",
      baseUrl,
      country,
      currency,
      language,
      timeoutMs,
      reason: configured
        ? "CHANNEL3_API_KEY is set; searches call the live Channel3 API."
        : "CHANNEL3_API_KEY is not set; discovery is unavailable (no fabricated results).",
      docs: CHANNEL3_DOCS_URL,
    },
  };
}

export class Channel3NotConfiguredError extends Error {
  constructor() {
    super("Channel3 discovery is unavailable: CHANNEL3_API_KEY is not set");
    this.name = "Channel3NotConfiguredError";
  }
}

export class Channel3Error extends Error {
  constructor(
    message: string,
    public readonly code:
      | "channel3-timeout"
      | "channel3-network"
      | "channel3-auth"
      | "channel3-not-found"
      | "channel3-rejected"
      | "channel3-rate-limited"
      | "channel3-provider"
      | "channel3-bad-response",
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "Channel3Error";
  }
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export const DiscoverySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(25).default(8),
  /** Optional ceiling in minor units; converted to Channel3 major-unit filter. */
  maxPriceMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  currency: CurrencyCodeSchema.optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  /** Agentic mode dumps full context into `query` (LLM-planned, slower). */
  mode: z.enum(["default", "agentic"]).default("default"),
});
export type DiscoverySearchInput = z.infer<typeof DiscoverySearchSchema>;

export const DiscoveryCompareSchema = z.object({
  productIds: z.array(z.string().min(1).max(200)).min(2).max(6),
  currency: CurrencyCodeSchema.optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
});
export type DiscoveryCompareInput = z.infer<typeof DiscoveryCompareSchema>;

export const DiscoveryLookupSchema = z.object({
  url: z.string().url().max(2000),
});
export type DiscoveryLookupInput = z.infer<typeof DiscoveryLookupSchema>;

// ---------------------------------------------------------------------------
// Lenient wire parsing (Channel3 may add fields; we read what we need)
// ---------------------------------------------------------------------------

const WireOfferSchema = z.looseObject({
  domain: z.string().optional(),
  merchant: z.string().optional(),
  retailer: z.string().optional(),
  website: z.string().optional(),
  price: z.unknown().optional(),
  url: z.string().optional(),
  buy_url: z.string().optional(),
  link: z.string().optional(),
  product_url: z.string().optional(),
  availability: z.unknown().optional(),
  in_stock: z.unknown().optional(),
});

const WireProductSchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  title: z.string().optional(),
  name: z.string().optional(),
  brand: z.unknown().optional(),
  image: z.string().optional(),
  image_url: z.string().optional(),
  url: z.string().optional(),
  product_url: z.string().optional(),
  offers: z.array(WireOfferSchema).optional(),
});

const WireSearchResponseSchema = z.looseObject({
  products: z.array(WireProductSchema).optional(),
  data: z.array(WireProductSchema).optional(),
  items: z.array(WireProductSchema).optional(),
});

const WireProductResponseSchema = z.looseObject({
  product: WireProductSchema.optional(),
});

// ---------------------------------------------------------------------------
// Normalization (lossy by design: unknowns stay unknown)
// ---------------------------------------------------------------------------

export type NormalizedAvailability = "in_stock" | "out_of_stock" | "unknown";

export interface NormalizedOffer {
  merchant: string;
  domain: string | null;
  priceMinor: number | null;
  currency: string | null;
  /** Original price rendering for display; null when absent. */
  priceRaw: string | null;
  availability: NormalizedAvailability;
  availabilityRaw: string | null;
  url: string | null;
}

export interface DiscoveryCandidate {
  productId: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  url: string | null;
  offers: NormalizedOffer[];
  offerCount: number;
  /** Best (lowest) known price; null when no offer carries a price. */
  bestPriceMinor: number | null;
  bestPriceCurrency: string | null;
  pricedOfferCount: number;
  inStockKnownCount: number;
  unknownAvailabilityCount: number;
  attribution: {
    source: "channel3";
    productId: string;
    searchedAt: string;
    query: string;
    locale: { country: string; currency: string; language: string };
    checkoutNote: string;
  };
}

const CHECKOUT_NOTE =
  "Discovery only: a Channel3 result does not authorize checkout. Payment stays on the explicitly authorized PayPal sandbox merchant offer.";

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** Parse a human price rendering into major units, or null when unparseable. */
export function parseMajorPrice(raw: string): number | null {
  const match = raw.replace(/\s+/g, "").match(/-?[\d.,]+/);
  if (match === null) return null;
  let digits = match[0] ?? "";
  if (digits === "") return null;
  const negative = digits.startsWith("-");
  if (negative) digits = digits.slice(1);
  const hasDot = digits.includes(".");
  const hasComma = digits.includes(",");
  if (hasDot && hasComma) {
    // Last separator is the decimal mark; the other is thousands.
    if (digits.lastIndexOf(".") > digits.lastIndexOf(",")) {
      digits = digits.replace(/,/g, "");
    } else {
      digits = digits.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    digits = /,\d{1,2}$/.test(digits) ? digits.replace(",", ".") : digits.replace(/,/g, "");
  }
  const major = Number.parseFloat(digits);
  if (!Number.isFinite(major) || major < 0) return null;
  return negative ? null : major;
}

function majorToMinor(currency: string, major: number): number | null {
  let decimals: number;
  try {
    decimals = currencyDecimals(currency);
  } catch {
    return null;
  }
  const minor = Math.round(major * 10 ** decimals);
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
}

/**
 * Normalize one wire offer price. `price` may be a string ("$129.99"),
 * a major-units number, or an object ({price, amount, value, currency}).
 * Only explicit minor-unit keys (cents/amount_minor/price_minor) are read
 * as minor units; everything else is major units. Unparseable → null.
 */
export function normalizePrice(
  raw: unknown,
  fallbackCurrency: string,
): { priceMinor: number | null; currency: string | null; priceRaw: string | null } {
  if (raw === null || raw === undefined) return { priceMinor: null, currency: null, priceRaw: null };
  if (typeof raw === "string") {
    if (raw.trim() === "") return { priceMinor: null, currency: null, priceRaw: null };
    const major = parseMajorPrice(raw);
    if (major === null) return { priceMinor: null, currency: null, priceRaw: raw.trim() };
    return { priceMinor: majorToMinor(fallbackCurrency, major), currency: fallbackCurrency, priceRaw: raw.trim() };
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { priceMinor: null, currency: null, priceRaw: String(raw) };
    return { priceMinor: majorToMinor(fallbackCurrency, raw), currency: fallbackCurrency, priceRaw: String(raw) };
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const currencyRaw = firstString(obj["currency"]);
    const currency = currencyRaw !== null ? currencyRaw.toUpperCase() : fallbackCurrency;
    const minorKeys = ["price_minor", "amount_minor", "amountMinor", "cents"] as const;
    for (const key of minorKeys) {
      const value = obj[key];
      if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
        return { priceMinor: value, currency, priceRaw: String(value) };
      }
    }
    const majorKeys = ["price", "amount", "value", "current"] as const;
    for (const key of majorKeys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim() !== "") {
        const major = parseMajorPrice(value);
        if (major === null) return { priceMinor: null, currency, priceRaw: value.trim() };
        return { priceMinor: majorToMinor(currency, major), currency, priceRaw: value.trim() };
      }
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return { priceMinor: majorToMinor(currency, value), currency, priceRaw: String(value) };
      }
    }
    return { priceMinor: null, currency, priceRaw: null };
  }
  return { priceMinor: null, currency: null, priceRaw: null };
}

/** Normalize availability. Anything unrecognized → "unknown" (never in-stock). */
export function normalizeAvailability(raw: unknown): { availability: NormalizedAvailability; raw: string | null } {
  if (typeof raw === "boolean") return { availability: raw ? "in_stock" : "out_of_stock", raw: String(raw) };
  if (typeof raw === "number") {
    if (raw > 0) return { availability: "in_stock", raw: String(raw) };
    if (raw === 0) return { availability: "out_of_stock", raw: String(raw) };
    return { availability: "unknown", raw: String(raw) };
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const text = raw.trim();
    const lower = text.toLowerCase();
    if (/(sold[\s_-]?out|out[\s_-]?of[\s_-]?stock|unavailable|not[\s_-]?available|backorder)/.test(lower)) {
      return { availability: "out_of_stock", raw: text };
    }
    if (/(in[\s_-]?stock|instock|available|ready[\s_-]?to[\s_-]?ship)/.test(lower)) {
      return { availability: "in_stock", raw: text };
    }
    return { availability: "unknown", raw: text };
  }
  return { availability: "unknown", raw: null };
}

function normalizeOffer(
  wire: z.infer<typeof WireOfferSchema>,
  fallbackCurrency: string,
): NormalizedOffer {
  const merchant = firstString(wire.merchant, wire.retailer, wire.domain, wire.website) ?? "unknown merchant";
  const domain = firstString(wire.domain, wire.website);
  const price = normalizePrice(wire.price, fallbackCurrency);
  const availability = normalizeAvailability(
    wire.availability ?? wire.in_stock ?? undefined,
  );
  return {
    merchant,
    domain,
    priceMinor: price.priceMinor,
    currency: price.currency,
    priceRaw: price.priceRaw,
    availability: availability.availability,
    availabilityRaw: availability.raw,
    url: firstString(wire.buy_url, wire.url, wire.link, wire.product_url),
  };
}

function brandOf(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  if (typeof raw === "object" && raw !== null) {
    const name = (raw as Record<string, unknown>)["name"];
    if (typeof name === "string" && name.trim() !== "") return name.trim();
  }
  return null;
}

export function normalizeProduct(
  wire: z.infer<typeof WireProductSchema>,
  input: { query: string; currency: string; country: string; language: string; searchedAt: string },
): DiscoveryCandidate {
  const offers = (wire.offers ?? []).map((offer) => normalizeOffer(offer, input.currency));
  const priced = offers.filter((o) => o.priceMinor !== null);
  const best = priced.length > 0
    ? priced.reduce((a, b) => ((b.priceMinor as number) < (a.priceMinor as number) ? b : a))
    : undefined;
  return {
    productId: String(wire.id),
    title: firstString(wire.title, wire.name) ?? `Channel3 product ${String(wire.id)}`,
    brand: brandOf(wire.brand),
    imageUrl: firstString(wire.image, wire.image_url),
    url: firstString(wire.url, wire.product_url),
    offers,
    offerCount: offers.length,
    bestPriceMinor: best?.priceMinor ?? null,
    bestPriceCurrency: best?.currency ?? null,
    pricedOfferCount: priced.length,
    inStockKnownCount: offers.filter((o) => o.availability === "in_stock").length,
    unknownAvailabilityCount: offers.filter((o) => o.availability === "unknown").length,
    attribution: {
      source: "channel3",
      productId: String(wire.id),
      searchedAt: input.searchedAt,
      query: input.query,
      locale: { country: input.country, currency: input.currency, language: input.language },
      checkoutNote: CHECKOUT_NOTE,
    },
  };
}

// ---------------------------------------------------------------------------
// Comparison (priced offers only; cross-currency rows are never merged)
// ---------------------------------------------------------------------------

export interface ComparisonGroup {
  currency: string;
  rows: { candidate: DiscoveryCandidate; offer: NormalizedOffer }[];
}

export interface ComparisonResult {
  groups: ComparisonGroup[];
  /** Offers without a usable price — listed, never ranked. */
  unpriced: { candidate: DiscoveryCandidate; offer: NormalizedOffer }[];
  warnings: string[];
}

export function compareCandidates(candidates: DiscoveryCandidate[]): ComparisonResult {
  const warnings: string[] = [];
  const priced: { candidate: DiscoveryCandidate; offer: NormalizedOffer }[] = [];
  const unpriced: { candidate: DiscoveryCandidate; offer: NormalizedOffer }[] = [];
  for (const candidate of candidates) {
    if (candidate.offers.length === 0) {
      warnings.push(`"${candidate.title}" returned no merchant offers.`);
    }
    for (const offer of candidate.offers) {
      if (offer.priceMinor !== null && offer.currency !== null) {
        priced.push({ candidate, offer });
      } else {
        unpriced.push({ candidate, offer });
      }
    }
  }
  const byCurrency = new Map<string, { candidate: DiscoveryCandidate; offer: NormalizedOffer }[]>();
  for (const row of priced) {
    const currency = (row.offer.currency as string).toUpperCase();
    const list = byCurrency.get(currency) ?? [];
    list.push(row);
    byCurrency.set(currency, list);
  }
  const groups: ComparisonGroup[] = [...byCurrency.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currency, rows]) => ({
      currency,
      rows: rows.sort((a, b) => (a.offer.priceMinor as number) - (b.offer.priceMinor as number)),
    }));
  if (groups.length > 1) {
    warnings.push(
      `Offers span ${groups.length} currencies (${groups.map((g) => g.currency).join(", ")}); totals are ranked within each currency only.`,
    );
  }
  if (unpriced.length > 0) {
    warnings.push(`${unpriced.length} offer(s) carry no usable price and are listed separately, unranked.`);
  }
  const unknownAvail = candidates.reduce((n, c) => n + c.unknownAvailabilityCount, 0);
  if (unknownAvail > 0) {
    warnings.push(`${unknownAvail} offer(s) have unknown availability; treat them as unverified, not as in-stock.`);
  }
  return { groups, unpriced, warnings };
}

// ---------------------------------------------------------------------------
// HTTP client (injectable fetch for tests; production uses global fetch)
// ---------------------------------------------------------------------------

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

const defaultFetch: FetchLike = (url, init) =>
  fetch(url, init) as unknown as Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

function toChannel3Error(status: number, bodyText: string): Channel3Error {
  const snippet = bodyText.slice(0, 300);
  if (status === 401 || status === 403) {
    return new Channel3Error(
      `Channel3 rejected the request (HTTP ${status}); check CHANNEL3_API_KEY. Provider said: ${snippet}`,
      "channel3-auth",
      status,
      false,
    );
  }
  if (status === 404) {
    return new Channel3Error(`Channel3 has no record for this lookup (HTTP 404). ${snippet}`, "channel3-not-found", status, false);
  }
  if (status === 422) {
    return new Channel3Error(`Channel3 rejected the request shape (HTTP 422). ${snippet}`, "channel3-rejected", status, false);
  }
  if (status === 429) {
    return new Channel3Error("Channel3 rate limit reached (HTTP 429); retry after a delay.", "channel3-rate-limited", status, true);
  }
  if (status >= 500) {
    return new Channel3Error(`Channel3 provider error (HTTP ${status}). ${snippet}`, "channel3-provider", status, true);
  }
  return new Channel3Error(`Channel3 request failed (HTTP ${status}). ${snippet}`, "channel3-provider", status, false);
}

export interface SearchResult {
  candidates: DiscoveryCandidate[];
  meta: {
    origin: "channel3-live";
    query: string;
    locale: { country: string; currency: string; language: string };
    searchedAt: string;
    latencyMs: number;
  };
}

export class Channel3Client {
  constructor(
    private readonly config: Channel3Config,
    private readonly fetchImpl: FetchLike = defaultFetch,
  ) {}

  get status(): Channel3Status {
    const configured = this.config.apiKey !== "";
    return {
      configured,
      mode: configured ? "live" : "unconfigured",
      baseUrl: this.config.baseUrl,
      country: this.config.country,
      currency: this.config.currency,
      language: this.config.language,
      timeoutMs: this.config.timeoutMs,
      reason: configured
        ? "CHANNEL3_API_KEY is set; searches call the live Channel3 API."
        : "CHANNEL3_API_KEY is not set; discovery is unavailable (no fabricated results).",
      docs: CHANNEL3_DOCS_URL,
    };
  }

  private assertConfigured(): void {
    if (this.config.apiKey === "") throw new Channel3NotConfiguredError();
  }

  private async request(path: string, init: { method: string; body?: unknown; query?: Record<string, string> }): Promise<unknown> {
    this.assertConfigured();
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await this.fetchImpl(url.toString(), {
        method: init.method,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
      if (!res.ok) throw toChannel3Error(res.status, await res.text().catch(() => ""));
      return await res.json();
    } catch (error) {
      if (error instanceof Channel3Error || error instanceof Channel3NotConfiguredError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new Channel3Error(
          `Channel3 request timed out after ${this.config.timeoutMs}ms.`,
          "channel3-timeout",
          undefined,
          true,
        );
      }
      throw new Channel3Error(
        `Channel3 request failed before a response arrived: ${error instanceof Error ? error.message : String(error)}`,
        "channel3-network",
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Live product search. Throws Channel3NotConfiguredError without a key. */
  async searchProducts(raw: unknown): Promise<SearchResult> {
    const input = DiscoverySearchSchema.parse(raw);
    const currency = (input.currency ?? this.config.currency).toUpperCase();
    const country = (input.country ?? this.config.country).toUpperCase();
    const started = Date.now();
    const filters: Record<string, unknown> = {};
    if (input.maxPriceMinor !== undefined) {
      let decimals = 2;
      try {
        decimals = currencyDecimals(currency);
      } catch {
        decimals = 2;
      }
      filters["price"] = { max_price: input.maxPriceMinor / 10 ** decimals };
    }
    const body: Record<string, unknown> = {
      query: input.query,
      limit: input.limit,
      config: { country, currency, language: this.config.language },
    };
    if (Object.keys(filters).length > 0) body["filters"] = filters;
    if (input.mode === "agentic") (body["config"] as Record<string, unknown>)["mode"] = "agentic";
    const json = await this.request("/v1/search", { method: "POST", body });
    const parsed = WireSearchResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Channel3Error("Channel3 returned an unrecognized search payload.", "channel3-bad-response", undefined, false);
    }
    const products = parsed.data.products ?? parsed.data.data ?? parsed.data.items ?? [];
    const searchedAt = new Date().toISOString();
    return {
      candidates: products.map((product) =>
        normalizeProduct(product, { query: input.query, currency, country, language: this.config.language, searchedAt }),
      ),
      meta: {
        origin: "channel3-live",
        query: input.query,
        locale: { country, currency, language: this.config.language },
        searchedAt,
        latencyMs: Date.now() - started,
      },
    };
  }

  /** Full product details (documented as a free call). */
  async getProduct(productId: string, overrides?: { currency?: string; country?: string }): Promise<DiscoveryCandidate> {
    if (productId.trim() === "") throw new Channel3Error("productId must not be empty.", "channel3-rejected", undefined, false);
    const currency = (overrides?.currency ?? this.config.currency).toUpperCase();
    const country = (overrides?.country ?? this.config.country).toUpperCase();
    const json = await this.request(`/v1/products/${encodeURIComponent(productId)}`, {
      method: "GET",
      query: { country, currency, language: this.config.language },
    });
    const asWrapper = WireProductResponseSchema.safeParse(json);
    const direct = WireProductSchema.safeParse(json);
    const wire = asWrapper.success && asWrapper.data.product !== undefined
      ? asWrapper.data.product
      : direct.success
        ? direct.data
        : null;
    if (wire === null) {
      throw new Channel3Error("Channel3 returned an unrecognized product payload.", "channel3-bad-response", undefined, false);
    }
    const searchedAt = new Date().toISOString();
    return normalizeProduct(wire, { query: `product:${productId}`, currency, country, language: this.config.language, searchedAt });
  }

  /**
   * Side-by-side comparison of 2–6 products. One product failing does not
   * fail the comparison: the failure is isolated per product id.
   */
  async compareProducts(raw: unknown): Promise<{ comparison: ComparisonResult; failures: { productId: string; error: string }[] }> {
    const input = DiscoveryCompareSchema.parse(raw);
    const candidates: DiscoveryCandidate[] = [];
    const failures: { productId: string; error: string }[] = [];
    for (const productId of input.productIds) {
      try {
        candidates.push(await this.getProduct(productId, { currency: input.currency, country: input.country }));
      } catch (error) {
        failures.push({ productId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { comparison: compareCandidates(candidates), failures };
  }

  /** Resolve a merchant URL to its canonical Channel3 product. */
  async lookupUrl(raw: unknown): Promise<DiscoveryCandidate> {
    const input = DiscoveryLookupSchema.parse(raw);
    const json = await this.request("/v1/lookup", {
      method: "POST",
      body: {
        url: input.url,
        config: { country: this.config.country, currency: this.config.currency, language: this.config.language },
      },
    });
    const asWrapper = WireProductResponseSchema.safeParse(json);
    const direct = WireProductSchema.safeParse(json);
    const wire = asWrapper.success && asWrapper.data.product !== undefined
      ? asWrapper.data.product
      : direct.success
        ? direct.data
        : null;
    if (wire === null) {
      throw new Channel3Error("Channel3 returned an unrecognized lookup payload.", "channel3-bad-response", undefined, false);
    }
    const searchedAt = new Date().toISOString();
    return normalizeProduct(wire, {
      query: `lookup:${input.url}`,
      currency: this.config.currency,
      country: this.config.country,
      language: this.config.language,
      searchedAt,
    });
  }
}
