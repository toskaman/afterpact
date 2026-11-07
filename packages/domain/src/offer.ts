import { z } from "zod";
import {
  NonNegativeMoneySchema,
  add,
  multiply,
  type Money,
} from "./money";

export const OfferItemSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPrice: NonNegativeMoneySchema,
});
export type OfferItem = z.infer<typeof OfferItemSchema>;

/** A merchant's priced answer to a PurchaseIntent. Totals must foot. */
export const OfferSchema = z
  .object({
    id: z.string().min(1),
    intentId: z.string().min(1),
    merchantId: z.string().min(1),
    items: z.array(OfferItemSchema).min(1).max(100),
    total: NonNegativeMoneySchema,
    expectedDeliveryDate: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    terms: z.string().max(4000).optional(),
    evidenceRequirements: z.array(z.string().min(1)).max(50).default([]),
    createdAt: z.iso.datetime(),
  })
  .superRefine((offer, ctx) => {
    for (const item of offer.items) {
      if (item.unitPrice.currency !== offer.total.currency) {
        ctx.addIssue({
          code: "custom",
          message: `item currency ${item.unitPrice.currency} must match total currency ${offer.total.currency}`,
        });
      }
    }
    const expected = itemsTotal(offer.items, offer.total.currency);
    if (expected.amountMinor !== offer.total.amountMinor) {
      ctx.addIssue({
        code: "custom",
        message: `total ${offer.total.amountMinor} does not foot to items sum ${expected.amountMinor}`,
      });
    }
  });
export type Offer = z.infer<typeof OfferSchema>;

/** Exact items footing in minor units. All items must share the currency. */
export function itemsTotal(items: OfferItem[], currency: string): Money {
  let total: Money = { currency, amountMinor: 0 };
  for (const item of items) {
    total = add(total, multiply(item.unitPrice, item.quantity));
  }
  return total;
}

export function isOfferExpired(offer: Offer, nowIso: string): boolean {
  return Date.parse(nowIso) > Date.parse(offer.validUntil);
}
