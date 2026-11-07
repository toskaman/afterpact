import { describe, expect, it } from "vitest";
import {
  ApprovalBindingError,
  ApprovalExpiredError,
  assertApprovalUsable,
  attachApproval,
  createPromise,
  isApprovalExpired,
} from "../../packages/domain/src/index";
import { makeApproval, makePromiseInput } from "./promise.test";

const T0 = "2026-11-07T12:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";
const FUTURE = "2027-01-01T00:00:00.000Z";

describe("approval binding + expiry", () => {
  it("usable approval passes", () => {
    const promise = createPromise(makePromiseInput());
    const approval = makeApproval(promise.id, promise.version, promise.hash);
    expect(isApprovalExpired(approval, T0)).toBe(false);
    expect(() =>
      assertApprovalUsable(approval, promise, T0),
    ).not.toThrow();
    const attached = attachApproval(promise, approval);
    expect(attached.approval?.id).toBe(approval.id);
  });

  it("wrong promise id / version / hash fails binding", () => {
    const promise = createPromise(makePromiseInput());
    const good = makeApproval(promise.id, promise.version, promise.hash);
    expect(() =>
      assertApprovalUsable({ ...good, promiseId: "other" }, promise, T0),
    ).toThrow(ApprovalBindingError);
    expect(() =>
      assertApprovalUsable({ ...good, promiseVersion: 99 }, promise, T0),
    ).toThrow(ApprovalBindingError);
    expect(() =>
      assertApprovalUsable(
        { ...good, promiseHash: "0".repeat(64) },
        promise,
        T0,
      ),
    ).toThrow(ApprovalBindingError);
  });

  it("expired approval throws ApprovalExpiredError", () => {
    const promise = createPromise(makePromiseInput());
    const expired = makeApproval(promise.id, promise.version, promise.hash);
    expired.expiresAt = PAST;
    expect(isApprovalExpired(expired, T0)).toBe(true);
    expect(() => assertApprovalUsable(expired, promise, T0)).toThrow(
      ApprovalExpiredError,
    );
    expect(() => assertApprovalUsable(expired, promise, PAST)).not.toThrow();
  });

  it("approval at the exact expiry instant is still usable", () => {
    const promise = createPromise(makePromiseInput());
    const approval = makeApproval(promise.id, promise.version, promise.hash);
    approval.expiresAt = T0;
    expect(isApprovalExpired(approval, T0)).toBe(false);
  });

  it("FUTURE constant sanity (guards test-clock drift)", () => {
    expect(Date.parse(FUTURE)).toBeGreaterThan(Date.parse(T0));
  });
});
