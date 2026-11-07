import { z } from "zod";
import { NonNegativeMoneySchema } from "./money";

export const RiskToleranceSchema = z.enum(["low", "standard", "high"]);
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export const MerchantConstraintsSchema = z.object({
  allow: z.array(z.string().min(1)).default([]),
  deny: z.array(z.string().min(1)).default([]),
});
export type MerchantConstraints = z.infer<typeof MerchantConstraintsSchema>;

/** A buyer's structured purchase need, before any merchant is selected. */
export const PurchaseIntentSchema = z.object({
  id: z.string().min(1),
  buyerId: z.string().min(1),
  rawText: z.string().min(1).max(4000),
  budget: NonNegativeMoneySchema,
  categories: z.array(z.string().min(1)).min(1).max(20),
  quantity: z.number().int().positive().default(1),
  deadline: z.iso.datetime(),
  merchantConstraints: MerchantConstraintsSchema.default({
    allow: [],
    deny: [],
  }),
  riskTolerance: RiskToleranceSchema.default("standard"),
  mandatory: z.array(z.string().min(1)).max(50).default([]),
  createdAt: z.iso.datetime(),
});
export type PurchaseIntent = z.infer<typeof PurchaseIntentSchema>;
