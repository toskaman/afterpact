import type { PromiseRecord } from "./store";
import type {
  Capture,
  Incident,
  LifecycleState,
  OutcomeEvent,
  RefundOperation,
  ResolutionApproval,
  ResolutionProposal,
} from "../../../packages/domain/src/index";

/**
 * Recovery Operations Timeline — dependency-aware schedule for one promise.
 *
 * This is the documented Bryntum fallback (no Bryntum trial license in this
 * build; see docs/sponsors/BRYNTUM_STATUS.md). The schedule is computed
 * from real store state, not hand-drawn: delivery expectations, evidence
 * deadlines, merchant response windows, customer notifications, refund
 * approval, settlement verification, and escalation. A detected incident
 * inserts an incident-response chain and shifts dependent tasks
 * (dependency-aware rescheduling), and a resolution decision updates the
 * approval/settlement tasks. The frontend renders these tasks as SVG;
 * docs/sponsors/BRYNTUM_UPGRADE_PATH.md maps each field to Bryntum Gantt.
 */

export type TimelineTaskKind =
  | "capture"
  | "delivery"
  | "evidence"
  | "merchant-window"
  | "notify"
  | "approval"
  | "settlement"
  | "escalation"
  | "incident-response"
  | "resolution";

export type TimelineTaskStatus =
  | "done"
  | "active"
  | "upcoming"
  | "overdue"
  | "blocked";

export interface TimelineTask {
  id: string;
  label: string;
  kind: TimelineTaskKind;
  start: string;
  end: string;
  status: TimelineTaskStatus;
  dependsOn: string[];
  /** Set when an incident shifted this task off its baseline. */
  shiftedByIncident?: { incidentId: string; baselineEnd: string; daysShifted: number; reason: string };
  origin: "real-api" | "computed-schedule";
  note: string;
}

export interface RecoveryTimeline {
  promiseId: string;
  state: LifecycleState;
  generatedAt: string;
  origin: "real-api";
  /** True when at least one task was rescheduled by an incident. */
  rescheduled: boolean;
  tasks: TimelineTask[];
  notes: string[];
}

export interface TimelineInput {
  record: PromiseRecord;
  outcomes: OutcomeEvent[];
  incidents: Incident[];
  proposals: ResolutionProposal[];
  approvals: ResolutionApproval[];
  captures: Capture[];
  refunds: RefundOperation[];
  nowIso: string;
}

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

function maxIso(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Baseline slip (days) an incident category injects into dependents. */
function slipDaysForCategory(category: string): number {
  switch (category) {
    case "not-delivered": return 7;
    case "late-delivery": return 3;
    case "wrong-item":
    case "quality": return 5;
    case "overcharge": return 2;
    default: return 2;
  }
}

const TERMINAL: LifecycleState[] = ["RESOLUTION_VERIFIED", "DECLINED", "EXPIRED", "CANCELED", "FAILED"];
const PAID: LifecycleState[] = [
  "PAYMENT_CAPTURED", "OUTCOME_MONITORING", "INCIDENT_DETECTED", "RESOLUTION_PROPOSED",
  "AWAITING_RESOLUTION_APPROVAL", "RESOLUTION_IN_PROGRESS", "RESOLUTION_VERIFIED", "ESCALATED",
];

function statusFor(nowMs: number, startMs: number, endMs: number, done: boolean, blocked: boolean): TimelineTaskStatus {
  if (done) return "done";
  if (blocked) return "blocked";
  if (nowMs > endMs) return "overdue";
  if (nowMs >= startMs) return "active";
  return "upcoming";
}

export function buildTimeline(input: TimelineInput): RecoveryTimeline {
  const { record, outcomes, incidents, proposals, approvals, captures, refunds, nowIso } = input;
  const promise = record.promise;
  const nowMs = Date.parse(nowIso);
  const tasks: TimelineTask[] = [];
  const notes: string[] = [];
  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "triaged" || i.status === "resolving");
  const firstIncident = [...incidents].sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt))[0];

  const incidentSlip = firstIncident !== undefined ? slipDaysForCategory(firstIncident.category) : 0;
  const rescheduled = firstIncident !== undefined && incidentSlip > 0;

  const paid = PAID.includes(record.state);
  const firstCapture = [...captures].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))[0];
  const approval = promise.approval;

  // -- capture window -------------------------------------------------------
  const captureEnd = approval !== null ? addDays(approval.approvedAt, 1) : addDays(promise.createdAt, 1);
  tasks.push({
    id: "capture",
    label: "Payment capture",
    kind: "capture",
    start: approval?.approvedAt ?? promise.createdAt,
    end: firstCapture?.capturedAt ?? captureEnd,
    status: statusFor(nowMs, Date.parse(approval?.approvedAt ?? promise.createdAt), Date.parse(firstCapture?.capturedAt ?? captureEnd), paid, approval === null),
    dependsOn: [],
    origin: "real-api",
    note: firstCapture !== undefined
      ? `Captured ${firstCapture.amount.amountMinor} ${firstCapture.amount.currency} (capture ${firstCapture.id}).`
      : approval === null
        ? "Blocked: promise is not approved yet."
        : "Capture window after buyer approval.",
  });

  // -- expected delivery (shifts when an incident lands) --------------------
  const deliveryBaselineEnd = promise.expectedDeliveryDate;
  const deliveryEnd = rescheduled && firstIncident !== undefined
    ? addDays(deliveryBaselineEnd, incidentSlip)
    : deliveryBaselineEnd;
  const delivered = outcomes.some((o) => o.kind === "delivery-scan" || o.kind === "buyer-confirmation");
  const deliveryTask: TimelineTask = {
    id: "delivery",
    label: "Expected delivery",
    kind: "delivery",
    start: firstCapture?.capturedAt ?? captureEnd,
    end: deliveryEnd,
    status: statusFor(nowMs, Date.parse(firstCapture?.capturedAt ?? captureEnd), Date.parse(deliveryEnd), delivered || TERMINAL.includes(record.state), !paid),
    dependsOn: ["capture"],
    origin: "computed-schedule",
    note: delivered ? "Delivery evidence observed." : `Promised by ${deliveryBaselineEnd}.`,
  };
  if (rescheduled && firstIncident !== undefined) {
    deliveryTask.shiftedByIncident = {
      incidentId: firstIncident.id,
      baselineEnd: deliveryBaselineEnd,
      daysShifted: incidentSlip,
      reason: `${firstIncident.category} incident ${firstIncident.id} pushed dependents by ${incidentSlip}d.`,
    };
    deliveryTask.note = `Rescheduled by incident ${firstIncident.id} (${firstIncident.category}): baseline ${deliveryBaselineEnd} → ${deliveryEnd}.`;
    notes.push(`Incident ${firstIncident.id} rescheduled delivery-dependent tasks by ${incidentSlip} day(s).`);
  }
  tasks.push(deliveryTask);

  // -- evidence deadline (depends on delivery) -------------------------------
  const evidenceBaselineEnd = addDays(deliveryBaselineEnd, 3);
  const evidenceEnd = addDays(deliveryEnd, 3);
  const evidenceDone = promise.evidenceRequirements.length === 0 || TERMINAL.includes(record.state);
  const evidenceTask: TimelineTask = {
    id: "evidence",
    label: "Evidence deadline",
    kind: "evidence",
    start: deliveryEnd,
    end: evidenceEnd,
    status: statusFor(nowMs, Date.parse(deliveryEnd), Date.parse(evidenceEnd), evidenceDone, !paid),
    dependsOn: ["delivery"],
    origin: "computed-schedule",
    note: promise.evidenceRequirements.length === 0
      ? "No evidence required by this promise."
      : `Requires: ${promise.evidenceRequirements.join(", ")}.`,
  };
  if (rescheduled && firstIncident !== undefined) {
    evidenceTask.shiftedByIncident = {
      incidentId: firstIncident.id,
      baselineEnd: evidenceBaselineEnd,
      daysShifted: incidentSlip,
      reason: `Follows delivery shift from incident ${firstIncident.id}.`,
    };
  }
  tasks.push(evidenceTask);

  // -- merchant response window ----------------------------------------------
  const windowStart = firstIncident?.detectedAt ?? deliveryEnd;
  const merchantTask: TimelineTask = {
    id: "merchant-window",
    label: "Merchant response window",
    kind: "merchant-window",
    start: windowStart,
    end: addDays(windowStart, 2),
    status: firstIncident === undefined
      ? "upcoming"
      : statusFor(nowMs, Date.parse(windowStart), Date.parse(addDays(windowStart, 2)), proposals.length > 0, false),
    dependsOn: firstIncident === undefined ? ["delivery"] : [],
    origin: "computed-schedule",
    note: firstIncident === undefined
      ? "Opens if an incident is detected."
      : `Opened by incident ${firstIncident.id}; closes with a resolution proposal.`,
  };
  tasks.push(merchantTask);

  // -- customer notification ---------------------------------------------------
  const notifyStart = firstIncident !== undefined ? addDays(firstIncident.detectedAt, 1) : deliveryEnd;
  tasks.push({
    id: "notify",
    label: "Customer notification",
    kind: "notify",
    start: notifyStart,
    end: addDays(notifyStart, 1),
    status: firstIncident === undefined
      ? "upcoming"
      : statusFor(nowMs, Date.parse(notifyStart), Date.parse(addDays(notifyStart, 1)), proposals.length > 0 || TERMINAL.includes(record.state), false),
    dependsOn: firstIncident === undefined ? ["delivery"] : ["merchant-window"],
    origin: "computed-schedule",
    note: firstIncident === undefined ? "Delivery confirmation notice." : `Notify buyer about incident ${firstIncident.id}.`,
  });

  // -- incident-response chain (only when an incident exists) ------------------
  if (firstIncident !== undefined) {
    tasks.push({
      id: "incident-response",
      label: `Incident response (${firstIncident.category})`,
      kind: "incident-response",
      start: firstIncident.detectedAt,
      end: addDays(firstIncident.detectedAt, 2),
      status: statusFor(
        nowMs,
        Date.parse(firstIncident.detectedAt),
        Date.parse(addDays(firstIncident.detectedAt, 2)),
        firstIncident.status === "resolved" || firstIncident.status === "dismissed",
        false,
      ),
      dependsOn: [],
      origin: "real-api",
      note: `Severity ${firstIncident.severity}, detected by ${firstIncident.detectedBy}: ${firstIncident.detail.slice(0, 140)}`,
    });
  }

  // -- refund approval + settlement + resolution -------------------------------
  const latestProposal = [...proposals].sort((a, b) => Date.parse(a.proposedAt) - Date.parse(b.proposedAt)).at(-1);
  const decision = latestProposal !== undefined
    ? approvals.find((a) => a.proposalId === latestProposal.id)
    : undefined;
  const approvalStart = latestProposal?.proposedAt ?? (firstIncident !== undefined ? addDays(firstIncident.detectedAt, 2) : deliveryEnd);
  tasks.push({
    id: "approval",
    label: "Refund approval",
    kind: "approval",
    start: approvalStart,
    end: addDays(approvalStart, 2),
    status: latestProposal === undefined
      ? (firstIncident === undefined ? "upcoming" : "blocked")
      : statusFor(nowMs, Date.parse(approvalStart), Date.parse(addDays(approvalStart, 2)), decision !== undefined, false),
    dependsOn: latestProposal === undefined ? (firstIncident === undefined ? ["delivery"] : ["incident-response"]) : ["incident-response"],
    origin: latestProposal === undefined ? "computed-schedule" : "real-api",
    note: latestProposal === undefined
      ? "Blocked until a resolution is proposed."
      : decision === undefined
        ? `Proposal ${latestProposal.id} (${latestProposal.kind}) awaits decision.`
        : `Proposal ${latestProposal.id} ${decision.decision} by ${decision.decidedBy}.`,
  });

  const latestRefund = [...refunds].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).at(-1);
  const settlementStart = latestRefund?.createdAt ?? (decision !== undefined ? decision.decidedAt : addDays(approvalStart, 2));
  const settlementDone = latestRefund?.status === "succeeded" || record.state === "RESOLUTION_VERIFIED";
  const settlementTask: TimelineTask = {
    id: "settlement",
    label: "Settlement verification",
    kind: "settlement",
    start: settlementStart,
    end: addDays(settlementStart, 2),
    status: latestRefund === undefined && decision === undefined
      ? "blocked"
      : statusFor(nowMs, Date.parse(settlementStart), Date.parse(addDays(settlementStart, 2)), settlementDone, false),
    dependsOn: ["approval"],
    origin: latestRefund === undefined ? "computed-schedule" : "real-api",
    note: latestRefund === undefined
      ? "Verifies refund settlement after approval."
      : `Refund ${latestRefund.id}: ${latestRefund.status}.`,
  };
  if (rescheduled && firstIncident !== undefined && !settlementDone) {
    settlementTask.shiftedByIncident = {
      incidentId: firstIncident.id,
      baselineEnd: addDays(settlementStart, 2),
      daysShifted: incidentSlip,
      reason: `Downstream of delivery shift from incident ${firstIncident.id}.`,
    };
  }
  tasks.push(settlementTask);

  if (latestProposal !== undefined) {
    tasks.push({
      id: "resolution",
      label: `Resolution (${latestProposal.kind})`,
      kind: "resolution",
      start: latestProposal.proposedAt,
      end: maxIso(addDays(latestProposal.proposedAt, 3), settlementTask.end),
      status: statusFor(
        nowMs,
        Date.parse(latestProposal.proposedAt),
        Date.parse(maxIso(addDays(latestProposal.proposedAt, 3), settlementTask.end)),
        record.state === "RESOLUTION_VERIFIED",
        decision === undefined,
      ),
      dependsOn: ["approval", "settlement"],
      origin: "real-api",
      note: latestProposal.rationale.slice(0, 160),
    });
  }

  // -- escalation (critical/high open incidents, or escalated state) ------------
  const escalated = record.state === "ESCALATED";
  const needsEscalation = escalated || openIncidents.some((i) => i.severity === "critical" || i.severity === "high");
  if (needsEscalation || escalated) {
    const trigger = openIncidents.find((i) => i.severity === "critical")
      ?? openIncidents.find((i) => i.severity === "high")
      ?? firstIncident;
    const escStart = trigger !== undefined ? addDays(trigger.detectedAt, 3) : deliveryEnd;
    tasks.push({
      id: "escalation",
      label: "Escalation review",
      kind: "escalation",
      start: escStart,
      end: addDays(escStart, 2),
      status: escalated ? "active" : statusFor(nowMs, Date.parse(escStart), Date.parse(addDays(escStart, 2)), TERMINAL.includes(record.state), false),
      dependsOn: trigger === undefined ? ["delivery"] : ["incident-response"],
      origin: "computed-schedule",
      note: escalated
        ? "Promise is escalated; human review owns the schedule."
        : `Armed by ${trigger?.severity} incident ${trigger?.id}.`,
    });
  }

  tasks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id));
  if (openIncidents.length === 0 && firstIncident === undefined) {
    notes.push("No incidents: schedule follows the promise baseline.");
  }
  return { promiseId: record.promise.id, state: record.state, generatedAt: nowIso, origin: "real-api", rescheduled, tasks, notes };
}
