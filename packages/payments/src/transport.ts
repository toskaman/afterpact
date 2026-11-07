import type { Money } from "../../domain/src/index";
import type { PayPalConfig, PayPalCredentials } from "./config";
import { assertLiveAllowed } from "./config";
import {
  PayPalConfigError,
  PayPalInvalidStateError,
  PayPalProviderError,
} from "./errors";
import {
  approveUrlOf,
  moneyToWire,
  PayPalErrorWireSchema,
  PayPalOrderWireSchema,
  PayPalRefundWireSchema,
  PayPalTokenWireSchema,
  PayPalVerifyWireSchema,
  wireToMoney,
  type PayPalOrderWire,
} from "./wire";

export interface CreateOrderInput {
  amount: Money;
  /** Sent as PayPal-Request-Id for provider-side idempotency. */
  requestId: string;
  /** Our local order id, echoed back on captures for webhook linkage. */
  customId?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface ProviderOrder {
  id: string;
  status: string;
  amount: Money;
  approveUrl?: string;
  captures: ProviderCapture[];
  raw: unknown;
}

export interface ProviderCapture {
  id: string;
  status: string;
  amount: Money;
  customId?: string;
  raw: unknown;
}

export interface RefundCaptureInput {
  captureId: string;
  /** Omitted amount means a full refund of the remaining balance. */
  amount?: Money;
  requestId: string;
  note?: string;
}

export interface ProviderRefund {
  id: string;
  status: string;
  amount: Money;
  raw: unknown;
}

export interface WebhookVerifyInput {
  transmissionId: string;
  timestamp: string;
  certUrl?: string;
  authAlgo?: string;
  transmissionSig: string;
  webhookId: string;
  /** Raw request body, byte-identical to what PayPal signed. */
  body: string;
}

/**
 * Provider boundary. The service talks only to this interface, so tests run
 * against the in-memory mock while production uses the HTTP transport.
 */
export interface PayPalTransport {
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  captureOrder(providerOrderId: string, requestId: string): Promise<ProviderCapture>;
  refundCapture(input: RefundCaptureInput): Promise<ProviderRefund>;
  getRefund(providerRefundId: string): Promise<ProviderRefund>;
  verifyWebhookSignature(input: WebhookVerifyInput): Promise<boolean>;
}

/** Minimal structural HTTP surface; keeps this module DOM-lib free. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface HttpRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export type FetchFn = (
  url: string,
  init: HttpRequestInit,
) => Promise<HttpResponse>;

function nodeFetch(url: string, init: HttpRequestInit): Promise<HttpResponse> {
  const fn = globalThis.fetch;
  if (typeof fn !== "function") {
    throw new PayPalConfigError("global fetch is unavailable in this runtime");
  }
  return (fn as unknown as FetchFn)(url, init);
}

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  /** Sent as PayPal-Request-Id on mutating calls. */
  requestId?: string;
  /** JSON body, or raw form body when contentType is overridden. */
  body?: unknown;
  contentType?: string;
  /** Skip the OAuth bearer header (token endpoint only). */
  anonymous?: boolean;
  basic?: { username: string; password: string };
}

/**
 * Real PayPal REST transport: client-credentials OAuth with cached tokens,
 * PayPal-Request-Id on every mutating call, sandbox enforced by config.
 */
export class HttpPayPalTransport implements PayPalTransport {
  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly config: PayPalConfig,
    private readonly credentials: PayPalCredentials,
    private readonly fetchFn: FetchFn = nodeFetch,
    private readonly clock: () => number = Date.now,
  ) {
    assertLiveAllowed(config);
    if (credentials.clientId === "" || credentials.clientSecret === "") {
      throw new PayPalConfigError(
        "PayPal credentials are required for the HTTP transport (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)",
      );
    }
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const wire = moneyToWire(input.amount);
    const body = {
      intent: "CAPTURE",
      purchase_units: [
        {
          ...(input.customId === undefined
            ? {}
            : { custom_id: input.customId }),
          amount: {
            currency_code: wire.currency_code,
            value: wire.value,
          },
        },
      ],
      ...(input.returnUrl === undefined && input.cancelUrl === undefined
        ? {}
        : {
            application_context: {
              ...(input.returnUrl === undefined
                ? {}
                : { return_url: input.returnUrl }),
              ...(input.cancelUrl === undefined
                ? {}
                : { cancel_url: input.cancelUrl }),
              user_action: "PAY_NOW",
            },
          }),
    };
    const json = await this.request({
      method: "POST",
      path: "/v2/checkout/orders",
      requestId: input.requestId,
      body,
    });
    return toProviderOrder(PayPalOrderWireSchema.parse(json), json);
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    const json = await this.request({
      method: "GET",
      path: `/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`,
    });
    return toProviderOrder(PayPalOrderWireSchema.parse(json), json);
  }

  async captureOrder(
    providerOrderId: string,
    requestId: string,
  ): Promise<ProviderCapture> {
    const json = await this.request({
      method: "POST",
      path: `/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`,
      requestId,
      body: {},
    });
    const order = PayPalOrderWireSchema.parse(json);
    const captures = capturesOf(order);
    const first = captures[0];
    if (first === undefined) {
      throw new PayPalProviderError(
        `capture of order ${providerOrderId} returned no captures`,
        200,
        "MISSING_CAPTURE",
        false,
      );
    }
    return first;
  }

  async refundCapture(input: RefundCaptureInput): Promise<ProviderRefund> {
    const wire =
      input.amount === undefined ? undefined : moneyToWire(input.amount);
    const json = await this.request({
      method: "POST",
      path: `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
      requestId: input.requestId,
      body: {
        ...(wire === undefined
          ? {}
          : {
              amount: {
                currency_code: wire.currency_code,
                value: wire.value,
              },
            }),
        ...(input.note === undefined ? {} : { note_to_payer: input.note }),
      },
    });
    const refund = PayPalRefundWireSchema.parse(json);
    // Live POST responses omit amount: use what we requested, else resolve
    // via GET (which carries the full object), else fail loudly on drift.
    if (refund.amount !== undefined) {
      return {
        id: refund.id,
        status: refund.status,
        amount: wireToMoney(refund.amount),
        raw: json,
      };
    }
    if (input.amount !== undefined) {
      return {
        id: refund.id,
        status: refund.status,
        amount: input.amount,
        raw: json,
      };
    }
    return this.getRefund(refund.id);
  }

  async getRefund(providerRefundId: string): Promise<ProviderRefund> {
    const json = await this.request({
      method: "GET",
      path: `/v2/payments/refunds/${encodeURIComponent(providerRefundId)}`,
    });
    const refund = PayPalRefundWireSchema.parse(json);
    if (refund.amount === undefined) {
      throw new PayPalInvalidStateError(
        `provider refund ${refund.id} has no amount; cannot determine refunded total`,
      );
    }
    return {
      id: refund.id,
      status: refund.status,
      amount: wireToMoney(refund.amount),
      raw: json,
    };
  }

  async verifyWebhookSignature(
    input: WebhookVerifyInput,
  ): Promise<boolean> {
    let event: unknown;
    try {
      event = JSON.parse(input.body) as unknown;
    } catch {
      return false;
    }
    const json = await this.request({
      method: "POST",
      path: "/v1/notifications/verify-webhook-signature",
      body: {
        transmission_id: input.transmissionId,
        transmission_time: input.timestamp,
        cert_url: input.certUrl ?? "",
        auth_algo: input.authAlgo ?? "",
        transmission_sig: input.transmissionSig,
        webhook_id: input.webhookId,
        webhook_event: event,
      },
    });
    return (
      PayPalVerifyWireSchema.parse(json).verification_status === "SUCCESS"
    );
  }

  /** OAuth client-credentials token, cached until 60s before expiry. */
  async accessToken(): Promise<string> {
    const cached = this.token;
    if (cached !== null && cached.expiresAtMs > this.clock()) return cached.value;
    const json = await this.request({
      method: "POST",
      path: "/v1/oauth2/token",
      body: "grant_type=client_credentials",
      contentType: "application/x-www-form-urlencoded",
      anonymous: true,
      basic: {
        username: this.credentials.clientId,
        password: this.credentials.clientSecret,
      },
    });
    const token = PayPalTokenWireSchema.parse(json);
    const marginMs = 60_000;
    this.token = {
      value: token.access_token,
      expiresAtMs: this.clock() + token.expires_in * 1000 - marginMs,
    };
    return token.access_token;
  }

  private async request(options: RequestOptions): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );
    try {
      const headers: Record<string, string> = {
        "Content-Type":
          options.contentType ?? "application/json",
        Accept: "application/json",
      };
      if (options.requestId !== undefined) {
        headers["PayPal-Request-Id"] = options.requestId;
      }
      if (options.basic !== undefined) {
        headers["Authorization"] = `Basic ${Buffer.from(`${options.basic.username}:${options.basic.password}`, "utf8").toString("base64")}`;
      } else if (options.anonymous !== true) {
        headers["Authorization"] = `Bearer ${await this.accessToken()}`;
      }
      const response = await this.fetchFn(
        `${this.config.apiBase}${options.path}`,
        {
          method: options.method,
          headers,
          body:
            options.body === undefined
              ? undefined
              : typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw await toProviderError(response, options.path);
      }
      if (response.status === 204) return {};
      const text = await response.text();
      if (text === "") return {};
      return JSON.parse(text) as unknown;
    } catch (error: unknown) {
      if (error instanceof PayPalProviderError) throw error;
      if (
        error !== null &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name: unknown }).name === "AbortError"
      ) {
        throw new PayPalProviderError(
          `PayPal request timed out after ${this.config.requestTimeoutMs}ms: ${options.method} ${options.path}`,
          0,
          "TIMEOUT",
          true,
        );
      }
      throw new PayPalProviderError(
        `PayPal request failed: ${options.method} ${options.path}: ${error instanceof Error ? error.message : String(error)}`,
        0,
        "NETWORK",
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function capturesOf(order: PayPalOrderWire): ProviderCapture[] {
  const out: ProviderCapture[] = [];
  for (const unit of order.purchase_units ?? []) {
    for (const capture of unit.payments?.captures ?? []) {
      out.push({
        id: capture.id,
        status: capture.status,
        amount: wireToMoney(capture.amount),
        customId: capture.custom_id ?? unit.custom_id,
        raw: capture,
      });
    }
  }
  return out;
}

function toProviderOrder(order: PayPalOrderWire, raw: unknown): ProviderOrder {
  const units = order.purchase_units ?? [];
  const firstUnit = units[0];
  const firstAmount = firstUnit?.amount;
  const captures = capturesOf(order);
  const firstCapture = captures[0];
  const amount =
    firstAmount !== undefined
      ? wireToMoney(firstAmount)
      : firstCapture !== undefined
        ? firstCapture.amount
        : { currency: "USD", amountMinor: 0 };
  return {
    id: order.id,
    status: order.status,
    amount,
    approveUrl: approveUrlOf(order),
    captures,
    raw,
  };
}

async function toProviderError(
  response: HttpResponse,
  path: string,
): Promise<PayPalProviderError> {
  let code: string | undefined;
  let message = `PayPal API error ${response.status} on ${path}`;
  try {
    const text = await response.text();
    const parsed = PayPalErrorWireSchema.safeParse(
      text === "" ? {} : (JSON.parse(text) as unknown),
    );
    if (parsed.success) {
      code = parsed.data.name;
      if (parsed.data.message !== undefined && parsed.data.message !== "") {
        message = `PayPal API error ${response.status} (${code ?? "UNKNOWN"}) on ${path}: ${parsed.data.message}`;
      } else if (code !== undefined) {
        message = `PayPal API error ${response.status} (${code}) on ${path}`;
      }
    }
  } catch {
    // Fall through with the generic message.
  }
  const retryable = response.status === 429 || response.status >= 500;
  return new PayPalProviderError(message, response.status, code, retryable);
}

