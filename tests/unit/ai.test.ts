import { describe, expect, it } from "vitest";
import {
  AIOutputError,
  validateIntentExtraction,
  validateOfferRanking,
} from "../../packages/domain/src/index";

describe("AI output validation", () => {
  it("accepts a valid intent extraction with defaults", () => {
    const parsed = validateIntentExtraction(
      JSON.stringify({
        budgetMinor: 5000,
        currency: "USD",
        categories: ["electronics"],
        deadline: "2026-12-01T00:00:00.000Z",
      }),
    );
    expect(parsed).toMatchObject({
      budgetMinor: 5000,
      currency: "USD",
      quantity: 1,
      riskTolerance: "standard",
      mandatory: [],
    });
  });

  it("rejects unknown keys (strict schema)", () => {
    expect(() =>
      validateIntentExtraction(
        JSON.stringify({
          budgetMinor: 5000,
          currency: "USD",
          categories: ["electronics"],
          deadline: "2026-12-01T00:00:00.000Z",
          surprizeField: "prompt drift",
        }),
      ),
    ).toThrow(AIOutputError);
  });

  it("rejects missing required fields and bad values", () => {
    expect(() =>
      validateIntentExtraction(JSON.stringify({ currency: "USD" })),
    ).toThrow(AIOutputError);
    expect(() =>
      validateIntentExtraction(
        JSON.stringify({
          budgetMinor: -5,
          currency: "USD",
          categories: ["x"],
          deadline: "2026-12-01T00:00:00.000Z",
        }),
      ),
    ).toThrow(AIOutputError);
    expect(() =>
      validateIntentExtraction(
        JSON.stringify({
          budgetMinor: 5,
          currency: "usd",
          categories: ["x"],
          deadline: "2026-12-01T00:00:00.000Z",
        }),
      ),
    ).toThrow(AIOutputError);
  });

  it("rejects malformed JSON loudly", () => {
    expect(() => validateIntentExtraction("{not json")).toThrow(AIOutputError);
    expect(() => validateIntentExtraction("")).toThrow(AIOutputError);
  });

  it("accepts a valid offer ranking and rejects out-of-range scores", () => {
    const parsed = validateOfferRanking(
      JSON.stringify({
        rankings: [
          { offerId: "offer_1", score: 0.9, reasons: ["cheapest"] },
          { offerId: "offer_2", score: 0.4, reasons: ["slow shipping"] },
        ],
      }),
    );
    expect(parsed.rankings).toHaveLength(2);
    expect(() =>
      validateOfferRanking(
        JSON.stringify({
          rankings: [{ offerId: "offer_1", score: 1.5, reasons: ["x"] }],
        }),
      ),
    ).toThrow(AIOutputError);
    expect(() =>
      validateOfferRanking(JSON.stringify({ rankings: [] })),
    ).toThrow(AIOutputError);
  });
});
