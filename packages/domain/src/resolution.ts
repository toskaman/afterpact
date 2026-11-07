import { z } from "zod";
import { NonNegativeMoneySchema } from "./money";

export const ResolutionKindSchema = z.enum([
  "refund-full",
  "refund-partial",
  "replacement",
  "credit",
  "escalate",
  "dismiss",
]);
export type ResolutionKind = z.infer<typeof ResolutionKindSchema>;

/** Proposed fix for an incident. Refund kinds must carry an exact amount. */
export const ResolutionProposalSchema = z
  .object({
    id: z.string().min(1),
    incidentId: z.string().min(1),
    promiseId: z.string().min(1),
    version: z.number().int().positive().default(1),
    kind: ResolutionKindSchema,
    amount: NonNegativeMoneySchema.optional(),
    rationale: z.string().min(1).max(4000),
    proposedBy: z.string().min(1),
    proposedAt: z.iso.datetime(),
  })
  .superRefine((proposal, ctx) => {
    const needsAmount =
      proposal.kind === "refund-full" || proposal.kind === "refund-partial";
    if (needsAmount && proposal.amount === undefined) {
      ctx.addIssue({ code: "custom", message: `${proposal.kind} requires amount` });
    }
    if (!needsAmount && proposal.amount !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: `${proposal.kind} must not carry amount`,
      });
    }
  });
export type ResolutionProposal = z.infer<typeof ResolutionProposalSchema>;

export const ResolutionDecisionSchema = z.enum(["approved", "rejected"]);
export type ResolutionDecision = z.infer<typeof ResolutionDecisionSchema>;

/** Buyer/operator decision on one proposal; expires like approvals. */
export const ResolutionApprovalSchema = z.object({
  id: z.string().min(1),
  proposalId: z.string().min(1),
  proposalVersion: z.number().int().positive(),
  decidedBy: z.string().min(1),
  decidedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  decision: ResolutionDecisionSchema,
  note: z.string().max(1000).optional(),
});
export type ResolutionApproval = z.infer<typeof ResolutionApprovalSchema>;

export function isResolutionApprovalExpired(
  approval: ResolutionApproval,
  nowIso: string,
): boolean {
  return Date.parse(nowIso) > Date.parse(approval.expiresAt);
}
