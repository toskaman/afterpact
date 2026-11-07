import { describe, expect, it } from "vitest";
import {
  appendEvent,
  findChainBreak,
  GENESIS_HASH,
  verifyChain,
  type AuditEvent,
} from "../../packages/domain/src/index";

const T0 = "2026-11-07T12:00:00.000Z";

function chainOf(n: number): AuditEvent[] {
  let entries: AuditEvent[] = [];
  for (let i = 0; i < n; i++) {
    entries = [...entries, appendEvent(entries, {
      type: `event.${i}`,
      promiseId: "promise_1",
      actor: "test",
      payload: { index: i },
      recordedAt: T0,
    })];
  }
  return entries;
}

describe("audit hash chain", () => {
  it("appends with seq + prevHash linkage from GENESIS", () => {
    const entries = chainOf(3);
    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(entries[0]?.prevHash).toBe(GENESIS_HASH);
    expect(entries[1]?.prevHash).toBe(entries[0]?.hash);
    expect(entries[2]?.prevHash).toBe(entries[1]?.hash);
    for (const e of entries) {
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("verifies an intact chain, including the empty chain", () => {
    expect(verifyChain([])).toBe(true);
    expect(verifyChain(chainOf(5))).toBe(true);
    expect(findChainBreak(chainOf(5))).toBe(-1);
  });

  it("detects payload tampering at the exact index", () => {
    const entries = chainOf(4);
    const tampered = entries.map((e, i) =>
      i === 1 ? { ...e, payload: { index: 999 } } : e,
    );
    expect(verifyChain(tampered)).toBe(false);
    expect(findChainBreak(tampered)).toBe(1);
  });

  it("detects reordering and truncation linkage breaks", () => {
    const entries = chainOf(3);
    const reordered = [entries[0]!, entries[2]!, entries[1]!];
    expect(verifyChain(reordered)).toBe(false);
  });
});
