import { describe, expect, it } from "vitest";
import {
  add,
  compare,
  CurrencyMismatchError,
  currencyDecimals,
  formatPayPalAmount,
  InvalidMoneyError,
  isNegative,
  isZero,
  minorUnitsPerMajor,
  money,
  multiply,
  parseMajorUnits,
  subtract,
  zero,
} from "../../packages/domain/src/index";

describe("currency decimals", () => {
  it("defaults to 2 and honors 0- and 3-decimal currencies", () => {
    expect(currencyDecimals("USD")).toBe(2);
    expect(currencyDecimals("EUR")).toBe(2);
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("KRW")).toBe(0);
    expect(currencyDecimals("BHD")).toBe(3);
    expect(currencyDecimals("KWD")).toBe(3);
    expect(minorUnitsPerMajor("USD")).toBe(100);
    expect(minorUnitsPerMajor("JPY")).toBe(1);
    expect(minorUnitsPerMajor("BHD")).toBe(1000);
  });

  it("rejects malformed currency codes", () => {
    expect(() => money("usd", 100)).toThrow();
    expect(() => money("USDD", 100)).toThrow();
    expect(() => money("", 100)).toThrow();
  });
});

describe("integer arithmetic", () => {
  it("adds, subtracts, and multiplies exactly", () => {
    expect(add(money("USD", 100), money("USD", 5))).toEqual({
      currency: "USD",
      amountMinor: 105,
    });
    expect(subtract(money("USD", 100), money("USD", 5))).toEqual({
      currency: "USD",
      amountMinor: 95,
    });
    expect(multiply(money("USD", 100), 3)).toEqual({
      currency: "USD",
      amountMinor: 300,
    });
    expect(zero("JPY")).toEqual({ currency: "JPY", amountMinor: 0 });
    expect(isZero(zero("USD"))).toBe(true);
    expect(isNegative(money("USD", -1))).toBe(true);
  });

  it("compares within one currency", () => {
    expect(compare(money("USD", 1), money("USD", 2))).toBe(-1);
    expect(compare(money("USD", 2), money("USD", 2))).toBe(0);
    expect(compare(money("USD", 3), money("USD", 2))).toBe(1);
  });

  it("throws CurrencyMismatchError across currencies", () => {
    expect(() => add(money("USD", 1), money("EUR", 1))).toThrow(
      CurrencyMismatchError,
    );
    expect(() => subtract(money("USD", 1), money("JPY", 1))).toThrow(
      CurrencyMismatchError,
    );
    expect(() => compare(money("USD", 1), money("EUR", 1))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("rejects unsafe factors", () => {
    expect(() => multiply(money("USD", 100), -1)).toThrow(InvalidMoneyError);
    expect(() => multiply(money("USD", 100), 1.5)).toThrow(InvalidMoneyError);
  });
});

describe("PayPal wire format", () => {
  it("formats with currency-native decimals", () => {
    expect(formatPayPalAmount(money("USD", 100))).toBe("1.00");
    expect(formatPayPalAmount(money("USD", 5))).toBe("0.05");
    expect(formatPayPalAmount(money("JPY", 100))).toBe("100");
    expect(formatPayPalAmount(money("BHD", 1000))).toBe("1.000");
    expect(formatPayPalAmount(money("USD", 0))).toBe("0.00");
    expect(formatPayPalAmount(money("USD", -150))).toBe("-1.50");
  });

  it("parses exact decimals without floats", () => {
    expect(parseMajorUnits("USD", "1.00")).toEqual({
      currency: "USD",
      amountMinor: 100,
    });
    expect(parseMajorUnits("JPY", "100")).toEqual({
      currency: "JPY",
      amountMinor: 100,
    });
    expect(parseMajorUnits("BHD", "1.234")).toEqual({
      currency: "BHD",
      amountMinor: 1234,
    });
  });

  it("round-trips format/parse", () => {
    for (const [currency, minor] of [
      ["USD", 1],
      ["USD", 999999],
      ["JPY", 42],
      ["BHD", 7],
      ["EUR", 100],
    ] as const) {
      const m = money(currency, minor);
      expect(parseMajorUnits(currency, formatPayPalAmount(m))).toEqual(m);
    }
  });

  it("rejects excess precision and garbage", () => {
    expect(() => parseMajorUnits("USD", "1.001")).toThrow(InvalidMoneyError);
    expect(() => parseMajorUnits("JPY", "1.5")).toThrow(InvalidMoneyError);
    expect(() => parseMajorUnits("USD", "abc")).toThrow(InvalidMoneyError);
    expect(() => parseMajorUnits("USD", "1,000.00")).toThrow(InvalidMoneyError);
    expect(() => parseMajorUnits("USD", "")).toThrow(InvalidMoneyError);
  });
});
