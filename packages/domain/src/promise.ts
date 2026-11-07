import { z } from "zod";
import { fingerprintOf } from "./hash";
import { NonNegativeMoneySchema } from "./money";
import { OfferItemSchema } from "./offer";
import { ApprovalSchema, type Approval } from "./approval";

export const TolerancesSchema = z.object({
  /** Whole days the delivery may slip before it counts as a miss. */
  maxDelayDays: z.number().int().min(0).max(365).default(0),
  /** Basis points of price drift tolerated (100 bps = 1%). */
  maxPriceDriftBps: z.number().int().min(0).max(10000).default(0),
});
export type Tolerances = z.infer<typeof TolerancesSchema>;

export const ResolutionPolicySchema = z.object({
  autoRefundOnMiss: z.boolean().default(false),
  /** Cap on automatic refunds, in basis points of the promise total. */
  maxAutoRefundBps: z.number().int().min(0).max(10000).default(10000),
  requireBuyerApproval: z.boolean().default(true),
});
export type ResolutionPolicy = z.infer<typeof ResolutionPolicySchema>;

/**
 * The commitment: versioned, hash-chained, approval-bound. `hash` covers
 * every field that defines the commitment EXCEPT `approval` itself
 * (the approval binds to the hash, so it cannot be part of it) and
 * `updatedAt` (a timestamp, not a commitment).
 */
export const PurchasePromiseSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  prevHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  intentId: z.string().min(1),
  offerId: z.string().min(1),
  buyerId: z.string().min(1),
  merchantId: z.string().min(1),
  total: NonNegativeMoneySchema,
  items: z.array(OfferItemSchema).min(1),
  expectedDeliveryDate: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  tolerances: TolerancesSchema,
  evidenceRequirements: z.array(z.string().min(1)).max(50).default([]),
  resolutionPolicy: ResolutionPolicySchema,
  approval: ApprovalSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PurchasePromise = z.infer<typeof PurchasePromiseSchema>;

export type NewPromiseInput = Pick<
  PurchasePromise,
  | "id"
  | "intentId"
  | "offerId"
  | "buyerId"
  | "merchantId"
  | "total"
  | "items"
  | "expectedDeliveryDate"
  | "validUntil"
  | "tolerances"
  | "evidenceRequirements"
  | "resolutionPolicy"
  | "createdAt"
>;

/** Fields covered by the integrity hash (excludes approval/updatedAt/hash). */
function hashInputOf(p: PurchasePromise): unknown {
  return {
    approval: null,
    buyerId: p.buyerId,
    createdAt: p.createdAt,
    evidenceRequirements: p.evidenceRequirements,
    expectedDeliveryDate: p.expectedDeliveryDate,
    id: p.id,
    intentId: p.intentId,
    items: p.items,
    merchantId: p.merchantId,
    offerId: p.offerId,
    prevHash: p.prevHash,
    resolutionPolicy: p.resolutionPolicy,
    tolerances: p.tolerances,
    total: p.total,
    validUntil: p.validUntil,
    version: p.version,
  };
}

/** Recompute the integrity hash for a promise (stable across key order). */
export function fingerprint(promise: PurchasePromise): string {
  return fingerprintOf(hashInputOf(promise));
}

/** True when the stored hash matches the recomputed fingerprint. */
export function verifyIntegrity(promise: PurchasePromise): boolean {
  return promise.hash === fingerprint(promise);
}

export function createPromise(input: NewPromiseInput): PurchasePromise {
  const draft = {
    ...input,
    version: 1,
    prevHash: null,
    approval: null,
    updatedAt: input.createdAt,
    hash: "",
  };
  const withHash = { ...draft, hash: fingerprint(draft as PurchasePromise) };
  return PurchasePromiseSchema.parse(withHash);
}

const MATERIAL_FIELDS = [
  "merchantId",
  "total",
  "items",
  "expectedDeliveryDate",
] as const;
export type MaterialField = (typeof MATERIAL_FIELDS)[number];

export interface PromisePatch {
  merchantId?: string;
  total?: PurchasePromise["total"];
  items?: PurchasePromise["items"];
  expectedDeliveryDate?: string;
  validUntil?: string;
  tolerances?: Tolerances;
  evidenceRequirements?: string[];
  resolutionPolicy?: PurchasePromise["resolutionPolicy"];
}

export interface PromiseChangeResult {
  promise: PurchasePromise;
  materialChange: boolean;
  changedFields: string[];
  approvalInvalidated: boolean;
}

/**
 * Apply a change as a new hash-chained version. Material changes
 * (merchant/total/items/delivery date) invalidate the approval and require
 * re-approval; non-material changes rebind the kept approval to the new
 * version + hash so the binding stays exact.
 */
export function proposeChange(
  current: PurchasePromise,
  patch: PromisePatch,
  changedAt: string,
): PromiseChangeResult {
  if (!verifyIntegrity(current)) {
    throw new Error("cannot change a promise with a broken integrity hash");
  }
  const changedFields = Object.keys(patch).filter(
    (k) => (patch as Record<string, unknown>)[k] !== undefined,
  );
  const materialChange = changedFields.some((f) =>
    (MATERIAL_FIELDS as readonly string[]).includes(f),
  );
  const next: PurchasePromise = {
    ...current,
    ...patch,
    version: current.version + 1,
    prevHash: current.hash,
    approval: null,
    updatedAt: changedAt,
    hash: "",
  };
  next.hash = fingerprint(next);
  let approvalInvalidated = false;
  if (materialChange) {
    approvalInvalidated = current.approval !== null;
  } else if (current.approval !== null) {
    const rebound: Approval = {
      ...current.approval,
      promiseVersion: next.version,
      promiseHash: next.hash,
    };
    next.approval = ApprovalSchema.parse(rebound);
  }
  return {
    promise: PurchasePromiseSchema.parse(next),
    materialChange,
    changedFields,
    approvalInvalidated,
  };
}

/** Attach an approval after checking it binds to this exact version + hash. */
export function attachApproval(
  promise: PurchasePromise,
  approval: Approval,
): PurchasePromise {
  const parsed = ApprovalSchema.parse(approval);
  if (parsed.promiseId !== promise.id) {
    throw new Error("approval binds a different promise id");
  }
  if (parsed.promiseVersion !== promise.version || parsed.promiseHash !== promise.hash) {
    throw new Error("approval does not bind to this promise version + hash");
  }
  return PurchasePromiseSchema.parse({ ...promise, approval: parsed });
}

export function isPromiseExpired(promise: PurchasePromise, nowIso: string): boolean {
  return Date.parse(nowIso) > Date.parse(promise.validUntil);
}
