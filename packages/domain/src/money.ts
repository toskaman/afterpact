import { z } from "zod";

export class CurrencyMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`currency mismatch: expected ${expected}, got ${actual}`);
    this.name = "CurrencyMismatchError";
  }
}

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

/** ISO-4217 style code; allowlist of decimals is enforced separately. */
export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "currency must be a 3-letter uppercase code");
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** Minor-unit decimals per currency. Default is 2 (e.g. USD, EUR). */
const DECIMALS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  COP: 0,
  CRC: 0,
  HUF: 0,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  PYG: 0,
  TWD: 0,
  UGX: 0,
  VND: 0,
};

export function currencyDecimals(currency: string): number {
  return DECIMALS[currency] ?? 2;
}

export function minorUnitsPerMajor(currency: string): number {
  return 10 ** currencyDecimals(currency);
}

/**
 * Exact money: integer minor units + currency. Amounts may be negative only
 * as transient differences; persisted domain values use non-negative schemas.
 */
export const MoneySchema = z.object({
  currency: CurrencyCodeSchema,
  amountMinor: z.number().int(),
});
export type Money = z.infer<typeof MoneySchema>;

export const NonNegativeMoneySchema = MoneySchema.extend({
  amountMinor: z.number().int().min(0),
});
export type NonNegativeMoney = z.infer<typeof NonNegativeMoneySchema>;

export function money(currency: string, amountMinor: number): Money {
  const parsed = MoneySchema.parse({ currency, amountMinor });
  if (!Number.isSafeInteger(parsed.amountMinor)) {
    throw new InvalidMoneyError("amountMinor must be a safe integer");
  }
  return parsed;
}

export function zero(currency: string): Money {
  return money(currency, 0);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const sum = a.amountMinor + b.amountMinor;
  if (!Number.isSafeInteger(sum)) {
    throw new InvalidMoneyError("money addition overflowed safe integer range");
  }
  return { currency: a.currency, amountMinor: sum };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const diff = a.amountMinor - b.amountMinor;
  if (!Number.isSafeInteger(diff)) {
    throw new InvalidMoneyError(
      "money subtraction overflowed safe integer range",
    );
  }
  return { currency: a.currency, amountMinor: diff };
}

export function multiply(m: Money, factor: number): Money {
  if (!Number.isSafeInteger(factor) || factor < 0) {
    throw new InvalidMoneyError("factor must be a non-negative safe integer");
  }
  const product = m.amountMinor * factor;
  if (!Number.isSafeInteger(product)) {
    throw new InvalidMoneyError(
      "money multiplication overflowed safe integer range",
    );
  }
  return { currency: m.currency, amountMinor: product };
}

/** -1 | 0 | 1. Throws on currency mismatch. */
export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor < b.amountMinor
    ? -1
    : a.amountMinor > b.amountMinor
      ? 1
      : 0;
}

export function isNegative(m: Money): boolean {
  return m.amountMinor < 0;
}

export function isZero(m: Money): boolean {
  return m.amountMinor === 0;
}

/**
 * Format for the PayPal wire format: exact decimal string with the currency's
 * native decimals, e.g. USD 100 -> "1.00", JPY 100 -> "100".
 */
export function formatPayPalAmount(m: Money): string {
  const decimals = currencyDecimals(m.currency);
  const negative = m.amountMinor < 0;
  const abs = Math.abs(m.amountMinor);
  const scale = 10 ** decimals;
  const major = Math.floor(abs / scale);
  const minor = abs % scale;
  const body =
    decimals === 0
      ? `${major}`
      : `${major}.${String(minor).padStart(decimals, "0")}`;
  return negative ? `-${body}` : body;
}

/**
 * Parse an exact decimal string into minor units. Rejects more fractional
 * digits than the currency allows and any non-decimal input. Never floats.
 */
export function parseMajorUnits(currency: string, input: string): Money {
  const code = CurrencyCodeSchema.parse(currency);
  const decimals = currencyDecimals(code);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) {
    throw new InvalidMoneyError(`invalid decimal amount: ${input}`);
  }
  const [, sign, majorPart, fracPart = ""] = match;
  if (fracPart.length > decimals) {
    throw new InvalidMoneyError(
      `${code} allows at most ${decimals} decimal places: ${input}`,
    );
  }
  const padded = fracPart.padEnd(decimals, "0");
  const minor = Number(`${majorPart}${padded === "" ? "" : padded}`);
  if (!Number.isSafeInteger(minor)) {
    throw new InvalidMoneyError(`amount out of safe integer range: ${input}`);
  }
  return { currency: code, amountMinor: sign === "-" ? -minor : minor };
}
