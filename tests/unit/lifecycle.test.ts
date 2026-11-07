import { describe, expect, it } from "vitest";
import {
  canTransition,
  InvalidTransitionError,
  isTerminal,
  TERMINAL_STATES,
  transition,
  transitionPath,
  TRANSITIONS,
  type LifecycleState,
} from "../../packages/domain/src/index";

const HAPPY_PATH: LifecycleState[] = [
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
];

describe("lifecycle state machine", () => {
  it("walks the full happy path to RESOLUTION_VERIFIED", () => {
    expect(transitionPath(HAPPY_PATH)).toBe("RESOLUTION_VERIFIED");
  });

  it("allows a clean no-incident close", () => {
    expect(
      transitionPath([
        "DRAFT",
        "OFFER_SELECTED",
        "AWAITING_APPROVAL",
        "APPROVED",
        "PAYMENT_PENDING",
        "PAYMENT_CAPTURED",
        "OUTCOME_MONITORING",
        "RESOLUTION_VERIFIED",
      ]),
    ).toBe("RESOLUTION_VERIFIED");
  });

  it("rejects illegal jumps with InvalidTransitionError", () => {
    expect(() => transition("DRAFT", "PAYMENT_CAPTURED")).toThrow(
      InvalidTransitionError,
    );
    expect(() => transition("APPROVED", "RESOLUTION_VERIFIED")).toThrow(
      InvalidTransitionError,
    );
    expect(() => transition("DRAFT", "RESOLUTION_VERIFIED")).toThrow(
      InvalidTransitionError,
    );
    expect(() =>
      transitionPath(["DRAFT", "OFFER_SELECTED", "APPROVED"]),
    ).toThrow(InvalidTransitionError);
  });

  it("supports declined/expired/canceled/failed/escalated branches", () => {
    expect(transition("AWAITING_APPROVAL", "DECLINED")).toBe("DECLINED");
    expect(
      transition("AWAITING_RESOLUTION_APPROVAL", "DECLINED"),
    ).toBe("DECLINED");
    expect(transition("AWAITING_APPROVAL", "EXPIRED")).toBe("EXPIRED");
    expect(transition("APPROVED", "EXPIRED")).toBe("EXPIRED");
    expect(transition("DRAFT", "CANCELED")).toBe("CANCELED");
    expect(transition("AWAITING_APPROVAL", "CANCELED")).toBe("CANCELED");
    expect(transition("PAYMENT_PENDING", "FAILED")).toBe("FAILED");
    expect(transition("RESOLUTION_IN_PROGRESS", "FAILED")).toBe("FAILED");
    expect(transition("OUTCOME_MONITORING", "ESCALATED")).toBe("ESCALATED");
    expect(transition("INCIDENT_DETECTED", "ESCALATED")).toBe("ESCALATED");
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TERMINAL_STATES.size).toBe(6);
    for (const state of TERMINAL_STATES) {
      expect(TRANSITIONS[state]).toEqual([]);
      expect(isTerminal(state)).toBe(true);
      for (const other of Object.keys(TRANSITIONS) as LifecycleState[]) {
        expect(canTransition(state, other)).toBe(false);
      }
    }
  });

  it("non-terminal states are not terminal", () => {
    for (const state of HAPPY_PATH.slice(0, -1)) {
      expect(isTerminal(state)).toBe(false);
    }
  });
});
