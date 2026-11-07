import { z } from "zod";
import {
  CurrencyCodeSchema,
  fingerprintOf,
} from "../../domain/src/index";

/**
 * AI-scoped payment tools. This module is intentionally pure: it imports
 * only Zod and the domain core — never the transport, HTTP client, store,
 * or service. AI agents receive ONLY these `propose*` functions, so by
 * construction they can draft a payment proposal but can never execute a
 * provider call. A proposal still requires buyer approval + policy
 * clearance before a human-driven path hands it to the payment service.
 *
 * A test (`scoped-tools do not touch the provider`) asserts this module
 * never imports provider-capable code. Keep it that way.
 */

export const ProposeOrderCreationSchema = z
  .object({
    promiseId: z.string().min(1),
    currency: CurrencyCodeSchema,
    amountMinor: z.number().int().min(0),
    customId: z.string().min(1).max(127).optional(),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .strict();
export type ProposeOrderCreation = z.infer<typeof ProposeOrderCreationSchema>;

export interface OrderProposal {
  tool: "paypal.propose.order";
  proposal: ProposeOrderCreation;
  payloadFingerprint: string;
  requiresHumanApproval: true;
  executesProviderCall: false;
}

export const ProposeCaptureSchema = z
  .object({
    orderId: z.string().min(1),
  })
  .strict();
export type ProposeCapture = z.infer<typeof ProposeCaptureSchema>;

export interface CaptureProposal {
  tool: "paypal.propose.capture";
  proposal: ProposeCapture;
  payloadFingerprint: string;
  requiresHumanApproval: true;
  executesProviderCall: false;
}

export const ProposeRefundSchema = z
  .object({
    captureId: z.string().min(1),
    promiseId: z.string().min(1),
    /** Omitted amount proposes a full refund of the remaining balance. */
    currency: CurrencyCodeSchema.optional(),
    amountMinor: z.number().int().positive().optional(),
    reason: z.string().min(1).max(2000),
  })
  .strict()
  .check((ctx) => {
    const hasCurrency = ctx.value.currency !== undefined;
    const hasAmount = ctx.value.amountMinor !== undefined;
    if (hasCurrency !== hasAmount) {
      ctx.issues.push({
        code: "custom",
        message:
          "currency and amountMinor must be provided together, or both omitted for a full refund",
        input: ctx.value,
      });
    }
  });
export type ProposeRefund = z.infer<typeof ProposeRefundSchema>;

export interface RefundProposal {
  tool: "paypal.propose.refund";
  proposal: ProposeRefund;
  payloadFingerprint: string;
  requiresHumanApproval: true;
  executesProviderCall: false;
}

/** Validate raw AI output into an order-creation proposal. No I/O. */
export function proposeOrderCreation(input: unknown): OrderProposal {
  const proposal = ProposeOrderCreationSchema.parse(input);
  return {
    tool: "paypal.propose.order",
    proposal,
    payloadFingerprint: fingerprintOf({ tool: "paypal.propose.order", proposal }),
    requiresHumanApproval: true,
    executesProviderCall: false,
  };
}

/** Validate raw AI output into a capture proposal. No I/O. */
export function proposeCapture(input: unknown): CaptureProposal {
  const proposal = ProposeCaptureSchema.parse(input);
  return {
    tool: "paypal.propose.capture",
    proposal,
    payloadFingerprint: fingerprintOf({
      tool: "paypal.propose.capture",
      proposal,
    }),
    requiresHumanApproval: true,
    executesProviderCall: false,
  };
}

/** Validate raw AI output into a refund proposal. No I/O. */
export function proposeRefund(input: unknown): RefundProposal {
  const proposal = ProposeRefundSchema.parse(input);
  return {
    tool: "paypal.propose.refund",
    proposal,
    payloadFingerprint: fingerprintOf({
      tool: "paypal.propose.refund",
      proposal,
    }),
    requiresHumanApproval: true,
    executesProviderCall: false,
  };
}

