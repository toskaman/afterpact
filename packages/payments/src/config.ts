import { z } from "zod";
import {
  PayPalConfigError,
  PayPalLiveDisabledError,
} from "./errors";

export const PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
export const PAYPAL_LIVE_BASE = "https://api-m.paypal.com";

/** Sandbox approval-site base used by the mock transport and docs. */
export const PAYPAL_SANDBOX_CHECKOUT_BASE =
  "https://www.sandbox.paypal.com/checkoutnow";

export const PayPalModeSchema = z.enum(["sandbox", "live"]);
export type PayPalMode = z.infer<typeof PayPalModeSchema>;

/**
 * Log-safe config: it carries no secrets, so logging it is safe.
 * Secrets travel in PayPalCredentials and are never logged.
 */
export const PayPalConfigSchema = z.object({
  mode: PayPalModeSchema,
  apiBase: z.string().url(),
  clientId: z.string().default(""),
  webhookId: z.string().min(1).optional(),
  /** Live requires an explicit opt-in; default is sandbox. */
  allowLive: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  requestTimeoutMs: z.number().int().positive().default(15000),
});
export type PayPalConfig = z.infer<typeof PayPalConfigSchema>;

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
}

export interface PayPalEnv {
  config: PayPalConfig;
  credentials: PayPalCredentials;
  /** Tests only: HMAC secret for the mock webhook signer. */
  mockWebhookSecret: string;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  throw new PayPalConfigError(`invalid boolean env value: ${raw}`);
}

/**
 * Build config + credentials from the environment. Never throws for missing
 * secrets: the HTTP transport validates credentials at construction, while
 * mock-only usage needs no secrets at all.
 */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): PayPalEnv {
  const modeRaw = (env["PAYPAL_MODE"] ?? "sandbox").trim().toLowerCase();
  const modeResult = PayPalModeSchema.safeParse(modeRaw);
  if (!modeResult.success) {
    throw new PayPalConfigError(
      `PAYPAL_MODE must be "sandbox" or "live", got ${JSON.stringify(modeRaw)}`,
    );
  }
  const mode = modeResult.data;
  const defaultBase = mode === "live" ? PAYPAL_LIVE_BASE : PAYPAL_SANDBOX_BASE;
  const apiBase = (env["PAYPAL_API_BASE"] ?? defaultBase).trim();
  const timeoutRaw = env["PAYPAL_REQUEST_TIMEOUT_MS"];
  const requestTimeoutMs =
    timeoutRaw === undefined || timeoutRaw.trim() === ""
      ? 15000
      : Number.parseInt(timeoutRaw, 10);
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new PayPalConfigError(
      `PAYPAL_REQUEST_TIMEOUT_MS must be a positive integer, got ${JSON.stringify(timeoutRaw)}`,
    );
  }
  const webhookId = env["PAYPAL_WEBHOOK_ID"]?.trim() || undefined;
  const parsed = PayPalConfigSchema.safeParse({
    mode,
    apiBase,
    clientId: env["PAYPAL_CLIENT_ID"] ?? "",
    webhookId,
    allowLive: parseBool(env["PAYPAL_ALLOW_LIVE"], false),
    killSwitch: parseBool(env["PAYPAL_KILL_SWITCH"], false),
    requestTimeoutMs,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new PayPalConfigError(
      `invalid PayPal config: ${first?.path.join(".") || "(root)"} ${first?.message ?? ""}`.trim(),
    );
  }
  const config = parsed.data;
  assertBaseMatchesMode(config);
  assertLiveAllowed(config);
  return {
    config,
    credentials: {
      clientId: env["PAYPAL_CLIENT_ID"] ?? "",
      clientSecret: env["PAYPAL_CLIENT_SECRET"] ?? "",
    },
    mockWebhookSecret: env["PAYPAL_MOCK_WEBHOOK_SECRET"] ?? "",
  };
}

/** The API base must be the exact known endpoint for the configured mode. */
export function assertBaseMatchesMode(config: PayPalConfig): void {
  const expected =
    config.mode === "live" ? PAYPAL_LIVE_BASE : PAYPAL_SANDBOX_BASE;
  if (config.apiBase !== expected) {
    throw new PayPalConfigError(
      `PAYPAL_API_BASE must be exactly ${expected} for mode "${config.mode}", got ${config.apiBase}`,
    );
  }
}

/** Live mode stays disabled unless explicitly allowed. */
export function assertLiveAllowed(config: PayPalConfig): void {
  if (config.mode === "live" && config.allowLive !== true) {
    throw new PayPalLiveDisabledError(
      "live PayPal mode is disabled by default; set PAYPAL_ALLOW_LIVE=true to opt in explicitly",
    );
  }
}

/** True when real network credentials are present for live-sandbox tests. */
export function hasLiveCredentials(env: PayPalEnv): boolean {
  return (
    env.credentials.clientId.length > 0 &&
    env.credentials.clientSecret.length > 0
  );
}

