export type PayPalErrorCode =
  | "paypal-provider"
  | "paypal-config"
  | "paypal-live-disabled"
  | "paypal-kill-switch"
  | "paypal-replay"
  | "paypal-concurrency"
  | "paypal-webhook-verification"
  | "paypal-webhook-replay"
  | "paypal-not-found"
  | "paypal-invalid-state";

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly code: PayPalErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options === undefined ? undefined : { cause: options.cause });
    this.name = "PayPalError";
  }
}

export class PayPalConfigError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-config");
    this.name = "PayPalConfigError";
  }
}

export class PayPalLiveDisabledError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-live-disabled");
    this.name = "PayPalLiveDisabledError";
  }
}

/** Thrown by mutating ops while the kill switch is engaged. Reads stay open. */
export class PayPalKillSwitchError extends PayPalError {
  constructor(message = "kill switch engaged: new payment operations refused") {
    super(message, "paypal-kill-switch");
    this.name = "PayPalKillSwitchError";
  }
}

/** Same idempotency key reused with a different payload fingerprint. */
export class PayPalReplayError extends PayPalError {
  constructor(public readonly key: string) {
    super(
      `idempotency key replay with different payload: ${key}`,
      "paypal-replay",
    );
    this.name = "PayPalReplayError";
  }
}

/** Lock acquisition or guarded execution timed out. */
export class PayPalConcurrencyError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-concurrency");
    this.name = "PayPalConcurrencyError";
  }
}

export class PayPalWebhookVerificationError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-webhook-verification");
    this.name = "PayPalWebhookVerificationError";
  }
}

/** Same webhook transmission id redelivered with a different body. */
export class PayPalWebhookReplayError extends PayPalError {
  constructor(public readonly transmissionId: string) {
    super(
      `webhook transmission replayed with different body: ${transmissionId}`,
      "paypal-webhook-replay",
    );
    this.name = "PayPalWebhookReplayError";
  }
}

export class PayPalNotFoundError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-not-found");
    this.name = "PayPalNotFoundError";
  }
}

/** Local record is in a state that forbids the requested transition. */
export class PayPalInvalidStateError extends PayPalError {
  constructor(message: string) {
    super(message, "paypal-invalid-state");
    this.name = "PayPalInvalidStateError";
  }
}

/** A provider call failed (network, auth, or PayPal error payload). */
export class PayPalProviderError extends PayPalError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerCode?: string,
    public readonly retryable = false,
  ) {
    super(message, "paypal-provider");
    this.name = "PayPalProviderError";
  }
}

