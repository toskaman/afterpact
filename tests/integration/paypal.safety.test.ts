import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertLiveAllowed,
  fromEnv,
  hasLiveCredentials,
  HttpPayPalTransport,
  isSecretKey,
  MockPayPalTransport,
  PAYPAL_LIVE_BASE,
  PAYPAL_SANDBOX_BASE,
  PaymentAuditLog,
  PayPalConfigError,
  PayPalKillSwitchError,
  PayPalLiveDisabledError,
  PayPalService,
  PaymentStore,
  proposeCapture,
  proposeOrderCreation,
  proposeRefund,
  redactUrlCredentials,
  redactValue,
  safeJson,
  type FetchFn,
  type PayPalConfig,
} from "../../packages/payments/src/index";

const NOW = "2026-11-07T12:00:00.000Z";
const USD_25 = { currency: "USD", amountMinor: 2500 };

function testConfig(overrides: Partial<PayPalConfig> = {}): PayPalConfig {
  return {
    mode: "sandbox",
    apiBase: PAYPAL_SANDBOX_BASE,
    clientId: "test-client",
    webhookId: "WH-TEST",
    allowLive: false,
    killSwitch: false,
    requestTimeoutMs: 5000,
    ...overrides,
  };
}

function setup() {
  const transport = new MockPayPalTransport("test-secret", () => NOW);
  const store = new PaymentStore();
  const audit = new PaymentAuditLog();
  const service = new PayPalService({
    config: testConfig(),
    transport,
    store,
    audit,
    now: () => NOW,
  });
  return { transport, store, audit, service };
}

describe("kill switch", () => {
  it("refuses new ops but keeps reads and webhook sync open", async () => {
    const ctx = setup();
    const created = await ctx.service.createOrder({
      promiseId: "promise-ks",
      amount: USD_25,
      idempotencyKey: "ks-order-key",
    });
    ctx.service.setKillSwitch(true);
    expect(ctx.service.killSwitchEngaged).toBe(true);

    await expect(
      ctx.service.createOrder({
        promiseId: "promise-ks",
        amount: USD_25,
        idempotencyKey: "ks-order-key-2",
      }),
    ).rejects.toBeInstanceOf(PayPalKillSwitchError);
    await expect(
      ctx.service.captureOrder({
        orderId: created.value.id,
        idempotencyKey: "ks-capture-key",
      }),
    ).rejects.toBeInstanceOf(PayPalKillSwitchError);
    await expect(
      ctx.service.refundCapture({
        captureId: "nope",
        promiseId: "promise-ks",
        reason: "x",
        idempotencyKey: "ks-refund-key",
      }),
    ).rejects.toBeInstanceOf(PayPalKillSwitchError);

    const read = await ctx.service.getOrderStatus(created.value.id);
    expect(read.order.id).toBe(created.value.id);

    const delivery = ctx.transport.issueWebhook(
      "CHECKOUT.ORDER.APPROVED",
      { id: created.value.providerOrderId },
    );
    const applied = await ctx.service.handleWebhook(
      delivery.headers,
      delivery.body,
    );
    expect(applied.outcome).toBe("applied");

    ctx.service.setKillSwitch(false);
    const after = await ctx.service.createOrder({
      promiseId: "promise-ks",
      amount: USD_25,
      idempotencyKey: "ks-order-key-3",
    });
    expect(after.duplicate).toBe(false);
  });
});

describe("secret redaction", () => {
  it("classifies secret-shaped keys and keeps plain words", () => {
    for (const key of [
      "client_secret",
      "clientSecret",
      "access_token",
      "accessToken",
      "Authorization",
      "auth",
      "password",
      "apiCredentials",
      "private_key",
      "webhookSecret",
    ]) {
      expect(isSecretKey(key)).toBe(true);
    }
    for (const key of ["author", "amount", "currency", "orderId", "status"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("redacts nested secrets and keeps the rest", () => {
    const redacted = redactValue({
      author: "buyer-1",
      clientSecret: "shh",
      nested: { token: "abc", amount: 5 },
      list: [{ password: "pw" }, "ok"],
    });
    expect(redacted).toEqual({
      author: "buyer-1",
      clientSecret: "[REDACTED]",
      nested: { token: "[REDACTED]", amount: 5 },
      list: [{ password: "[REDACTED]" }, "ok"],
    });
    expect(redactUrlCredentials("https://user:hunter2@host/x")).toBe(
      "https://user:[REDACTED]@host/x",
    );
    expect(safeJson({ secret: "s" })).toBe('{"secret":"[REDACTED]"}');
  });

  it("never stores secrets in audit entries or structured logs", () => {
    const lines: unknown[] = [];
    const audit = new PaymentAuditLog((entry) => {
      lines.push(entry);
    });
    audit.record({
      type: "probe",
      payload: {
        clientSecret: "super-secret-value",
        authorization: "Bearer abc",
        orderId: "ord-1",
      },
    });
    const dumped = JSON.stringify({ entries: audit.entries, lines });
    expect(dumped).not.toContain("super-secret-value");
    expect(dumped).not.toContain("Bearer abc");
    expect(dumped).toContain("[REDACTED]");
    expect(dumped).toContain("ord-1");
  });
});

describe("sandbox-only config", () => {
  it("defaults to sandbox and rejects live without explicit opt-in", () => {
    const env = fromEnv({} as NodeJS.ProcessEnv);
    expect(env.config.mode).toBe("sandbox");
    expect(env.config.apiBase).toBe(PAYPAL_SANDBOX_BASE);
    expect(hasLiveCredentials(env)).toBe(false);

    expect(() =>
      fromEnv({ PAYPAL_MODE: "live" } as NodeJS.ProcessEnv),
    ).toThrow(PayPalLiveDisabledError);
    expect(() =>
      assertLiveAllowed(testConfig({ mode: "live", apiBase: PAYPAL_LIVE_BASE })),
    ).toThrow(PayPalLiveDisabledError);

    const live = fromEnv({
      PAYPAL_MODE: "live",
      PAYPAL_ALLOW_LIVE: "true",
      PAYPAL_API_BASE: PAYPAL_LIVE_BASE,
      PAYPAL_CLIENT_ID: "id",
      PAYPAL_CLIENT_SECRET: "secret",
    } as NodeJS.ProcessEnv);
    expect(live.config.mode).toBe("live");
    expect(hasLiveCredentials(live)).toBe(true);
  });

  it("rejects mismatched bases and malformed values", () => {
    expect(() =>
      fromEnv({
        PAYPAL_MODE: "sandbox",
        PAYPAL_API_BASE: "https://evil.example.com",
      } as NodeJS.ProcessEnv),
    ).toThrow(PayPalConfigError);
    expect(
      () => fromEnv({ PAYPAL_MODE: "nope" } as NodeJS.ProcessEnv),
    ).toThrow(PayPalConfigError);
    expect(
      () =>
        fromEnv({ PAYPAL_ALLOW_LIVE: "maybe" } as NodeJS.ProcessEnv),
    ).toThrow(PayPalConfigError);
  });

  it("refuses HTTP transport without credentials", () => {
    expect(
      () =>
        new HttpPayPalTransport(testConfig(), { clientId: "", clientSecret: "" }),
    ).toThrow(PayPalConfigError);
  });
});

describe("http transport (stubbed fetch)", () => {
  interface Seen {
    url: string;
    init: { method: string; headers: Record<string, string>; body?: string };
  }

  function stub(
    handler: (url: string) => { status: number; body: unknown },
  ): { fetchFn: FetchFn; seen: Seen[] } {
    const seen: Seen[] = [];
    const fetchFn: FetchFn = (url, init) => {
      seen.push({
        url,
        init: {
          method: init.method,
          headers: { ...init.headers },
          body: init.body,
        },
      });
      const { status, body } = handler(url);
      const text = JSON.stringify(body);
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(text),
      });
    };
    return { fetchFn, seen };
  }

  const creds = { clientId: "id", clientSecret: "secret" };

  it("fetches an oauth token once and reuses it", async () => {
    let tokenHits = 0;
    const { fetchFn } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        tokenHits += 1;
        return {
          status: 200,
          body: { access_token: "tok-1", expires_in: 3600, token_type: "Bearer" },
        };
      }
      return { status: 404, body: { name: "NOT_FOUND" } };
    });
    const transport = new HttpPayPalTransport(
      testConfig(),
      creds,
      fetchFn,
      () => 1_000_000,
    );
    await expect(transport.accessToken()).resolves.toBe("tok-1");
    await expect(transport.accessToken()).resolves.toBe("tok-1");
    expect(tokenHits).toBe(1);
  });

  it("sends bearer + PayPal-Request-Id and maps the order wire", async () => {
    const { fetchFn, seen } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return {
          status: 200,
          body: { access_token: "tok-9", expires_in: 3600, token_type: "Bearer" },
        };
      }
      return {
        status: 201,
        body: {
          id: "ORDER-1",
          status: "PAYER_ACTION_REQUIRED",
          purchase_units: [
            { amount: { currency_code: "USD", value: "25.00" } },
          ],
          links: [
            {
              rel: "approve",
              href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1",
            },
          ],
        },
      };
    });
    const transport = new HttpPayPalTransport(testConfig(), creds, fetchFn);
    const order = await transport.createOrder({
      amount: USD_25,
      requestId: "req-test-123",
    });
    expect(order.id).toBe("ORDER-1");
    expect(order.amount).toEqual(USD_25);
    expect(order.approveUrl).toContain("checkoutnow");
    const create = seen.find((s) => s.url.endsWith("/v2/checkout/orders"));
    expect(create?.init.headers["PayPal-Request-Id"]).toBe("req-test-123");
    expect(create?.init.headers["Authorization"]).toBe("Bearer tok-9");
  });

  it("accepts amountless POST refund responses (live sandbox truth)", async () => {
    // Live POST /v2/payments/captures/{id}/refund returns only
    // {id, status, links} — no amount. The transport must use the
    // requested amount instead of throwing a ZodError.
    const { fetchFn } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return {
          status: 200,
          body: { access_token: "t", expires_in: 3600, token_type: "Bearer" },
        };
      }
      return { status: 201, body: { id: "REF-1", status: "COMPLETED", links: [] } };
    });
    const transport = new HttpPayPalTransport(testConfig(), creds, fetchFn);
    const refund = await transport.refundCapture({
      captureId: "CAP-1",
      amount: USD_25,
      requestId: "req-refund-1",
    });
    expect(refund.id).toBe("REF-1");
    expect(refund.status).toBe("COMPLETED");
    expect(refund.amount).toEqual(USD_25);
  });

  it("resolves full-refund amounts with a GET when POST omits them", async () => {
    // Full refund (no requested amount) + amountless POST: the transport
    // follows up with GET /v2/payments/refunds/{id}, which carries amount.
    const { fetchFn, seen } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return {
          status: 200,
          body: { access_token: "t", expires_in: 3600, token_type: "Bearer" },
        };
      }
      if (url.includes("/v2/payments/refunds/REF-FULL")) {
        return {
          status: 200,
          body: {
            id: "REF-FULL",
            status: "COMPLETED",
            amount: { currency_code: "USD", value: "25.00" },
          },
        };
      }
      return { status: 201, body: { id: "REF-FULL", status: "COMPLETED", links: [] } };
    });
    const transport = new HttpPayPalTransport(testConfig(), creds, fetchFn);
    const refund = await transport.refundCapture({
      captureId: "CAP-1",
      requestId: "req-refund-full",
    });
    expect(refund.id).toBe("REF-FULL");
    expect(refund.amount).toEqual(USD_25);
    expect(seen.some((s) => s.url.includes("/v2/payments/refunds/REF-FULL"))).toBe(true);
  });

  it("maps provider errors with retryable flags", async () => {
    const { fetchFn } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return {
          status: 200,
          body: { access_token: "t", expires_in: 3600, token_type: "Bearer" },
        };
      }
      if (url.includes("/rate-limited")) {
        return { status: 429, body: { name: "RATE_LIMIT_REACHED" } };
      }
      return {
        status: 422,
        body: { name: "ORDER_NOT_APPROVED", message: "approve first" },
      };
    });
    const transport = new HttpPayPalTransport(testConfig(), creds, fetchFn);
    const limited = await transport
      .getOrder("rate-limited")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(limited).toMatchObject({
      status: 429,
      providerCode: "RATE_LIMIT_REACHED",
      retryable: true,
    });
    const invalid = await transport
      .getOrder("plain")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(invalid).toMatchObject({
      status: 422,
      providerCode: "ORDER_NOT_APPROVED",
      retryable: false,
    });
  });

  it("times out hung requests as retryable", async () => {
    const hanging: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    const tokenOnly: FetchFn = (url, init) => {
      if (url.endsWith("/v1/oauth2/token")) {
        const body = {
          access_token: "t",
          expires_in: 3600,
          token_type: "Bearer",
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      }
      return hanging(url, init);
    };
    const transport = new HttpPayPalTransport(
      testConfig({ requestTimeoutMs: 20 }),
      creds,
      tokenOnly,
    );
    await expect(transport.getOrder("x")).rejects.toMatchObject({
      providerCode: "TIMEOUT",
      retryable: true,
    });
  });

  it("verifies webhook signatures through the api and rejects malformed bodies", async () => {
    const { fetchFn } = stub((url) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return {
          status: 200,
          body: { access_token: "t", expires_in: 3600, token_type: "Bearer" },
        };
      }
      return { status: 200, body: { verification_status: "SUCCESS" } };
    });
    const transport = new HttpPayPalTransport(testConfig(), creds, fetchFn);
    await expect(
      transport.verifyWebhookSignature({
        transmissionId: "t",
        timestamp: NOW,
        transmissionSig: "s",
        webhookId: "WH-TEST",
        body: '{"id":"e"}',
      }),
    ).resolves.toBe(true);
    await expect(
      transport.verifyWebhookSignature({
        transmissionId: "t",
        timestamp: NOW,
        transmissionSig: "s",
        webhookId: "WH-TEST",
        body: "not-json",
      }),
    ).resolves.toBe(false);
  });
});

describe("ai scoped tools", () => {
  it("proposes without touching the provider", () => {
    const transport = new MockPayPalTransport("s");
    const order = proposeOrderCreation({
      promiseId: "p-1",
      currency: "USD",
      amountMinor: 100,
    });
    expect(order.tool).toBe("paypal.propose.order");
    expect(order.executesProviderCall).toBe(false);
    expect(order.requiresHumanApproval).toBe(true);
    expect(order.payloadFingerprint).toMatch(/^[0-9a-f]{64}$/);

    const capture = proposeCapture({ orderId: "ord-1" });
    expect(capture.tool).toBe("paypal.propose.capture");

    const refund = proposeRefund({
      captureId: "cap-1",
      promiseId: "p-1",
      reason: "damaged",
    });
    expect(refund.tool).toBe("paypal.propose.refund");
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects unknown keys and half-specified refund amounts", () => {
    expect(() =>
      proposeOrderCreation({
        promiseId: "p",
        currency: "USD",
        amountMinor: 1,
        extra: true,
      }),
    ).toThrow(z.ZodError);
    expect(() =>
      proposeRefund({
        captureId: "c",
        promiseId: "p",
        currency: "USD",
        reason: "x",
      }),
    ).toThrow(z.ZodError);
  });

  it("keeps the scoped-tools module free of provider imports", () => {
    const source = readFileSync(
      new URL(
        "../../packages/payments/src/scopedTools.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((s): s is string => s !== undefined);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const spec of specifiers) {
      expect(["zod", "../../domain/src/index"]).toContain(spec);
    }
    expect(source).not.toMatch(/PayPalService|HttpPayPalTransport|fetch\(/);
  });
});

