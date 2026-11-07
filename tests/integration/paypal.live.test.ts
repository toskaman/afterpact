import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  fromEnv,
  hasLiveCredentials,
  HttpPayPalTransport,
} from "../../packages/payments/src/index";

/**
 * Live PayPal Sandbox probe. Runs ONLY when sandbox credentials are present
 * (PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET); otherwise the suite skips
 * cleanly with no failure. Creates one $1.00 order and abandons it before
 * approval: no capture, no money movement.
 */
const env = fromEnv();
const LIVE =
  hasLiveCredentials(env) &&
  env.config.mode === "sandbox" &&
  process.env["PAYPAL_LIVE_TEST"] !== "0";
const describeLive = LIVE ? describe : describe.skip;

describeLive("paypal live sandbox", () => {
  it(
    "oauth + create + get order (abandoned, no money moves)",
    async () => {
      const transport = new HttpPayPalTransport(
        env.config,
        env.credentials,
      );
      const token = await transport.accessToken();
      expect(token.length).toBeGreaterThan(0);

      const order = await transport.createOrder({
        amount: { currency: "USD", amountMinor: 100 },
        requestId: `live_${randomUUID()}`,
        customId: "afterpact-live-probe",
      });
      expect(order.id).toBeTruthy();
      // Live truth (verified 2026-11-07 against api-m.sandbox.paypal.com):
      // an order created without payment_source is CREATED with an approve
      // link — PAYER_ACTION_REQUIRED only applies with a payment_source.
      expect(order.status).toBe("CREATED");
      expect(order.approveUrl).toContain("paypal.com");

      const fetched = await transport.getOrder(order.id);
      expect(fetched.id).toBe(order.id);
      expect(fetched.amount).toEqual({
        currency: "USD",
        amountMinor: 100,
      });
    },
    60_000,
  );
});

