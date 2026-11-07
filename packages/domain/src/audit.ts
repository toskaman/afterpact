import { z } from "zod";
import { fingerprintOf } from "./hash";

export const GENESIS_HASH = "GENESIS";

/**
 * One Flight Recorder entry. Append-only and hash-chained: each entry's
 * hash covers its sequence number, predecessor hash, and content. There is
 * deliberately no update or delete API.
 */
export const AuditEventSchema = z.object({
  seq: z.number().int().min(0),
  prevHash: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  type: z.string().min(1).max(200),
  promiseId: z.string().min(1).optional(),
  actor: z.string().min(1).max(200).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  recordedAt: z.iso.datetime(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export type NewAuditEventInput = Pick<
  AuditEvent,
  "type" | "payload" | "recordedAt"
> &
  Partial<Pick<AuditEvent, "promiseId" | "actor">>;

function entryHash(
  seq: number,
  prevHash: string,
  input: NewAuditEventInput,
): string {
  return fingerprintOf({
    actor: input.actor ?? null,
    payload: input.payload,
    prevHash,
    promiseId: input.promiseId ?? null,
    recordedAt: input.recordedAt,
    seq,
    type: input.type,
  });
}

/** Append one entry to an in-memory chain. The input array is not mutated. */
export function appendEvent(
  entries: readonly AuditEvent[],
  input: NewAuditEventInput,
): AuditEvent {
  const seq = entries.length;
  const prevHash = seq === 0 ? GENESIS_HASH : mustGet(entries, seq - 1).hash;
  const event = {
    seq,
    prevHash,
    hash: entryHash(seq, prevHash, input),
    type: input.type,
    promiseId: input.promiseId,
    actor: input.actor,
    payload: input.payload,
    recordedAt: input.recordedAt,
  };
  return AuditEventSchema.parse(event);
}

function mustGet(entries: readonly AuditEvent[], index: number): AuditEvent {
  const entry = entries[index];
  if (entry === undefined) throw new Error(`audit chain missing seq ${index}`);
  return entry;
}

/** Index of the first broken entry, or -1 when the chain verifies. */
export function findChainBreak(entries: readonly AuditEvent[]): number {
  for (let i = 0; i < entries.length; i++) {
    const entry = mustGet(entries, i);
    if (entry.seq !== i) return i;
    const expectedPrev = i === 0 ? GENESIS_HASH : mustGet(entries, i - 1).hash;
    if (entry.prevHash !== expectedPrev) return i;
    const recomputed = entryHash(i, entry.prevHash, {
      type: entry.type,
      promiseId: entry.promiseId,
      actor: entry.actor,
      payload: entry.payload,
      recordedAt: entry.recordedAt,
    });
    if (recomputed !== entry.hash) return i;
  }
  return -1;
}

export function verifyChain(entries: readonly AuditEvent[]): boolean {
  return findChainBreak(entries) === -1;
}
