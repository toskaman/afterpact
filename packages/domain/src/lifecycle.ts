import { z } from "zod";

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`invalid lifecycle transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export const LifecycleStateSchema = z.enum([
  "DRAFT",
  "OFFER_SELECTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PAYMENT_PENDING",
  "PAYMENT_CAPTURED",
  "OUTCOME_MONITORING",
  "INCIDENT_DETECTED",
  "RESOLUTION_PROPOSED",
  "AWAITING_RESOLUTION_APPROVAL",
  "RESOLUTION_IN_PROGRESS",
  "RESOLUTION_VERIFIED",
  "DECLINED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
  "ESCALATED",
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

/**
 * Explicit transition table. Every legal move is listed; anything else fails
 * safely via InvalidTransitionError. Terminal states have no outgoing edges.
 */
export const TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  DRAFT: ["OFFER_SELECTED", "CANCELED", "EXPIRED"],
  OFFER_SELECTED: ["AWAITING_APPROVAL", "DRAFT", "CANCELED", "EXPIRED"],
  AWAITING_APPROVAL: ["APPROVED", "DECLINED", "EXPIRED", "CANCELED"],
  APPROVED: ["PAYMENT_PENDING", "CANCELED", "EXPIRED"],
  PAYMENT_PENDING: ["PAYMENT_CAPTURED", "FAILED", "CANCELED", "EXPIRED"],
  PAYMENT_CAPTURED: ["OUTCOME_MONITORING", "FAILED"],
  OUTCOME_MONITORING: [
    "INCIDENT_DETECTED",
    "RESOLUTION_VERIFIED",
    "ESCALATED",
    "CANCELED",
  ],
  INCIDENT_DETECTED: ["RESOLUTION_PROPOSED", "ESCALATED", "CANCELED"],
  RESOLUTION_PROPOSED: [
    "AWAITING_RESOLUTION_APPROVAL",
    "ESCALATED",
    "CANCELED",
  ],
  AWAITING_RESOLUTION_APPROVAL: [
    "RESOLUTION_IN_PROGRESS",
    "DECLINED",
    "EXPIRED",
    "ESCALATED",
    "CANCELED",
  ],
  RESOLUTION_IN_PROGRESS: ["RESOLUTION_VERIFIED", "FAILED", "ESCALATED"],
  RESOLUTION_VERIFIED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELED: [],
  FAILED: [],
  ESCALATED: [],
};

export const TERMINAL_STATES: ReadonlySet<LifecycleState> = new Set([
  "RESOLUTION_VERIFIED",
  "DECLINED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
  "ESCALATED",
]);

export function isTerminal(state: LifecycleState): boolean {
  return TERMINAL_STATES.has(state);
}

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Guard a transition; throws InvalidTransitionError on any illegal move. */
export function transition(from: LifecycleState, to: LifecycleState): LifecycleState {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

/** Walk a full path, throwing on the first illegal step. Returns the end state. */
export function transitionPath(path: readonly LifecycleState[]): LifecycleState {
  const first = path[0];
  if (first === undefined) throw new InvalidTransitionError("", "");
  let current = first;
  for (const next of path.slice(1)) {
    current = transition(current, next);
  }
  return current;
}
