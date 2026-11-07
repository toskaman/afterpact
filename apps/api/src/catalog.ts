import {
  itemsTotal,
  OfferSchema,
  type Offer,
  type OfferItem,
  type PurchaseIntent,
} from "../../../packages/domain/src/index";

/**
 * Deterministic demo catalog. Labeled SIMULATED CATALOG everywhere it is
 * served: Channel3 live discovery is a sibling-owned integration. Entries are
 * fixed so the flagship demo is reproducible.
 */

export interface CatalogMerchant {
  id: string;
  name: string;
  owner: string;
  blocked?: boolean;
}

export const DEMO_MERCHANTS: CatalogMerchant[] = [
  { id: "demo-merchant-acme", name: "Acme Field Supply (sandbox demo)", owner: "afterpact-demo" },
  { id: "demo-merchant-northwind", name: "Northwind Traders (sandbox demo)", owner: "afterpact-demo" },
];

export const FLAGSHIP_SKU = "SENSOR-KIT-3";

interface CatalogEntry {
  merchantId: string;
  sku: string;
  name: string;
  unitPriceMinor: number;
  currency: string;
  leadDays: number;
  terms: string;
}

const CATALOG: CatalogEntry[] = [
  {
    merchantId: "demo-merchant-acme",
    sku: "SENSOR-KIT-3",
    name: "Field sensor kit (3-pack, IP67)",
    unitPriceMinor: 12999,
    currency: "USD",
    leadDays: 7,
    terms: "Demo catalog listing. Includes calibration certificate. 30-day returns.",
  },
  {
    merchantId: "demo-merchant-northwind",
    sku: "SENSOR-KIT-3",
    name: "Field sensor kit (3-pack, ruggedized)",
    unitPriceMinor: 13499,
    currency: "USD",
    leadDays: 5,
    terms: "Demo catalog listing. Extended warranty available. 14-day returns.",
  },
  {
    merchantId: "demo-merchant-acme",
    sku: "SENSOR-KIT-1",
    name: "Field sensor kit (single unit)",
    unitPriceMinor: 4999,
    currency: "USD",
    leadDays: 7,
    terms: "Demo catalog listing. 30-day returns.",
  },
];

/**
 * Build reproducible offers for an intent from the fixed catalog. The first
 * offer always comes from the authorized flagship merchant so the demo path
 * is stable; prices scale from the catalog unit price.
 */
export function offersForIntent(intent: PurchaseIntent, nowIso: string): Offer[] {
  const nowMs = Date.parse(nowIso);
  const validUntil = new Date(nowMs + 7 * 86_400_000).toISOString();
  const qty = Math.max(1, intent.quantity);
  return CATALOG.filter((c) => {
    if (intent.merchantConstraints.allow.length > 0) {
      return intent.merchantConstraints.allow.some(
        (a) => c.merchantId.includes(a.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
      );
    }
    return true;
  })
    .filter((c) => !intent.merchantConstraints.deny.some((d) => c.merchantId.includes(d.toLowerCase())))
    .map((entry, index) => {
      const items: OfferItem[] = [
        { sku: entry.sku, name: entry.name, quantity: qty, unitPrice: { currency: entry.currency, amountMinor: entry.unitPriceMinor } },
      ];
      const total = itemsTotal(items, entry.currency);
      return OfferSchema.parse({
        id: `offer-${intent.id.slice(0, 8)}-${index}`,
        intentId: intent.id,
        merchantId: entry.merchantId,
        items,
        total,
        expectedDeliveryDate: new Date(nowMs + entry.leadDays * 86_400_000).toISOString(),
        validUntil,
        terms: entry.terms,
        evidenceRequirements: ["packing-slip", "delivery-scan"],
        createdAt: nowIso,
      });
    });
}

/** Flagship offer: Acme 3 x SENSOR-KIT-3 @ $129.99 = $389.97. */
export function flagshipOffer(intent: PurchaseIntent, nowIso: string): Offer {
  const offers = offersForIntent(intent, nowIso);
  const pick = offers.find((o) => o.merchantId === "demo-merchant-acme" && o.items[0]?.sku === FLAGSHIP_SKU)
    ?? offers.find((o) => o.merchantId === "demo-merchant-acme")
    ?? offers[0];
  if (pick === undefined) throw new Error("demo catalog produced no offers for intent");
  return pick;
}
