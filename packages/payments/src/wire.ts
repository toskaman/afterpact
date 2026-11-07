import { z } from "zod";
import {
  CurrencyCodeSchema,
  formatPayPalAmount,
  parseMajorUnits,
  type Money,
} from "../../domain/src/index";

/** PayPal `amount` wire object: exact decimal string + currency. */
export const PayPalMoneyWireSchema = z.object({
  currency_code: CurrencyCodeSchema,
  value: z.string().min(1),
});
export type PayPalMoneyWire = z.infer<typeof PayPalMoneyWireSchema>;

/** Wire -> exact minor units. Never floats. */
export function wireToMoney(wire: PayPalMoneyWire): Money {
  return parseMajorUnits(wire.currency_code, wire.value);
}

/** Exact minor units -> wire decimal string with native currency decimals. */
export function moneyToWire(amount: Money): PayPalMoneyWire {
  return {
    currency_code: amount.currency,
    value: formatPayPalAmount(amount),
  };
}

const PayPalLinkSchema = z.object({
  rel: z.string(),
  href: z.string(),
  method: z.string().optional(),
});

const PayPalCaptureWireSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: PayPalMoneyWireSchema,
  custom_id: z.string().optional(),
  links: z.array(PayPalLinkSchema).optional(),
});

const PayPalPurchaseUnitSchema = z.object({
  custom_id: z.string().optional(),
  amount: PayPalMoneyWireSchema.optional(),
  payments: z
    .object({
      captures: z.array(PayPalCaptureWireSchema).optional(),
    })
    .optional(),
});

/** GET /v2/checkout/orders/{id} and POST .../capture response shape. */
export const PayPalOrderWireSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  purchase_units: z.array(PayPalPurchaseUnitSchema).optional(),
  links: z.array(PayPalLinkSchema).optional(),
});
export type PayPalOrderWire = z.infer<typeof PayPalOrderWireSchema>;

/** POST /v2/payments/captures/{id}/refund and GET refund response shape. */
export const PayPalRefundWireSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  amount: PayPalMoneyWireSchema,
  custom_id: z.string().optional(),
  links: z.array(PayPalLinkSchema).optional(),
});
export type PayPalRefundWire = z.infer<typeof PayPalRefundWireSchema>;

/** POST /v1/oauth2/token response shape. */
export const PayPalTokenWireSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
});
export type PayPalTokenWire = z.infer<typeof PayPalTokenWireSchema>;

/** POST /v1/notifications/verify-webhook-signature response shape. */
export const PayPalVerifyWireSchema = z.object({
  verification_status: z.string().min(1),
});
export type PayPalVerifyWire = z.infer<typeof PayPalVerifyWireSchema>;

/** PayPal error envelope (`name` carries the machine code). */
export const PayPalErrorWireSchema = z.object({
  name: z.string().optional(),
  message: z.string().optional(),
});
export type PayPalErrorWire = z.infer<typeof PayPalErrorWireSchema>;

/** Extract the `approve` link (buyer approval URL) from an order payload. */
export function approveUrlOf(order: PayPalOrderWire): string | undefined {
  return order.links?.find((link) => link.rel === "approve")?.href;
}

/** Extract the parent id from an `up` link, e.g. `.../orders/{id}`. */
export function parentIdOfUpLink(
  links: Array<{ rel: string; href: string }> | undefined,
): string | undefined {
  const up = links?.find((link) => link.rel === "up")?.href;
  if (up === undefined) return undefined;
  const tail = up.split("?")[0]?.split("/").pop();
  return tail === undefined || tail === "" ? undefined : tail;
}

