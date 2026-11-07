import { z } from "zod";
import { CurrencyCodeSchema } from "./money";
import { RiskToleranceSchema } from "./intent";

export class AIOutputError extends Error {
  constructor(
    message: string,
    public readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "AIOutputError";
  }
}

/**
 * Strict schema for AI intent extraction. Strict on purpose: unknown keys
 * are rejected so prompt drift surfaces as a loud error, never silent data.
 */
export const IntentExtractionSchema = z
  .object({
    budgetMinor: z.number().int().min(0),
    currency: CurrencyCodeSchema,
    categories: z.array(z.string().min(1)).min(1).max(20),
    quantity: z.number().int().positive().default(1),
    deadline: z.iso.datetime(),
    riskTolerance: RiskToleranceSchema.default("standard"),
    mandatory: z.array(z.string().min(1)).max(50).default([]),
  })
  .strict();
export type IntentExtraction = z.infer<typeof IntentExtractionSchema>;

const OfferRankSchema = z
  .object({
    offerId: z.string().min(1),
    score: z.number().min(0).max(1),
    reasons: z.array(z.string().min(1)).min(1).max(10),
  })
  .strict();

export const OfferRankingSchema = z
  .object({
    rankings: z.array(OfferRankSchema).min(1).max(50),
  })
  .strict();
export type OfferRanking = z.infer<typeof OfferRankingSchema>;

/** Parse raw model text as JSON, throwing AIOutputError on syntax errors. */
export function parseAIJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AIOutputError(`${label}: model output is not valid JSON`);
  }
}

/** Parse + strictly validate raw model output against a schema. */
export function validateAIOutput<T>(
  schema: z.ZodType<T>,
  raw: string,
  label: string,
): T {
  const json = parseAIJson(raw, label);
  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new AIOutputError(`${label}: invalid model output`, issues);
  }
  return result.data;
}

export function validateIntentExtraction(raw: string): IntentExtraction {
  return validateAIOutput(IntentExtractionSchema, raw, "intent-extraction");
}

export function validateOfferRanking(raw: string): OfferRanking {
  return validateAIOutput(OfferRankingSchema, raw, "offer-ranking");
}
