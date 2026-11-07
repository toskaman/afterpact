import { z } from "zod";

export class ApprovalBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalBindingError";
  }
}

export class ApprovalExpiredError extends Error {
  constructor(public readonly expiresAt: string) {
    super(`approval expired at ${expiresAt}`);
    this.name = "ApprovalExpiredError";
  }
}

export const ApprovalMethodSchema = z.enum(["manual", "policy-auto"]);
export type ApprovalMethod = z.infer<typeof ApprovalMethodSchema>;

/**
 * Buyer approval bound to one exact promise version + hash. Binding, not
 * intent: it authorizes nothing else, and it expires.
 */
export const ApprovalSchema = z.object({
  id: z.string().min(1),
  promiseId: z.string().min(1),
  promiseVersion: z.number().int().positive(),
  promiseHash: z.string().regex(/^[0-9a-f]{64}$/),
  approvedBy: z.string().min(1),
  approvedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  method: ApprovalMethodSchema,
  note: z.string().max(1000).optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export function isApprovalExpired(approval: Approval, nowIso: string): boolean {
  return Date.parse(nowIso) > Date.parse(approval.expiresAt);
}

/** Minimal shape needed to check an approval binding (avoids a cycle). */
export interface ApprovablePromise {
  id: string;
  version: number;
  hash: string;
}

/**
 * Throws ApprovalBindingError when the approval does not bind to this exact
 * promise version + hash, ApprovalExpiredError past expiry.
 */
export function assertApprovalUsable(
  approval: Approval,
  promise: ApprovablePromise,
  nowIso: string,
): void {
  if (approval.promiseId !== promise.id) {
    throw new ApprovalBindingError(
      `approval ${approval.id} binds promise ${approval.promiseId}, not ${promise.id}`,
    );
  }
  if (approval.promiseVersion !== promise.version) {
    throw new ApprovalBindingError(
      `approval binds version ${approval.promiseVersion}, promise is at ${promise.version}`,
    );
  }
  if (approval.promiseHash !== promise.hash) {
    throw new ApprovalBindingError(
      "approval binds a different promise hash (promise changed since approval)",
    );
  }
  if (isApprovalExpired(approval, nowIso)) {
    throw new ApprovalExpiredError(approval.expiresAt);
  }
}
