import { describe, expect, it } from "vitest";
import {
  attachApproval,
  canonicalize,
  createPromise,
  fingerprint,
  proposeChange,
  PurchasePromiseSchema,
  verifyIntegrity,
  type Approval,
  type NewPromiseInput,
} from "../../packages/domain/src/index";

const T0 = "2026-11-07T12:00:00.000Z";
const T1 = "2026-11-07T13:00:00.000Z";
const FUTURE = "2027-01-01T00:00:00.000Z";

export function makePromiseInput(overrides: Partial<NewPromiseInput> = {}): NewPromiseInput {
  return {
    id: "promise_1",
    intentId: "intent_1",
    offerId: "offer_1",
    buyerId: "buyer_1",
    merchantId: "merchant_acme",
    total: { currency: "USD", amountMinor: 2500 },
    items: [
      {
        name: "Widget",
        quantity: 1,
        unitPrice: { currency: "USD", amountMinor: 2500 },
      },
    ],
    expectedDeliveryDate: "2026-12-01T00:00:00.000Z",
    validUntil: "2026-12-15T00:00:00.000Z",
    tolerances: { maxDelayDays: 2, maxPriceDriftBps: 100 },
    evidenceRequirements: ["tracking-number"],
    resolutionPolicy: {
      autoRefundOnMiss: false,
      maxAutoRefundBps: 10000,
      requireBuyerApproval: true,
    },
    createdAt: T0,
    ...overrides,
  };
}

export function makeApproval(
  promiseId: string,
  version: number,
  hash: string,
): Approval {
  return {
    id: "appr_1",
    promiseId,
    promiseVersion: version,
    promiseHash: hash,
    approvedBy: "buyer_1",
    approvedAt: T0,
    expiresAt: FUTURE,
    method: "manual",
  };
}

describe("PurchasePromise schema", () => {
  it("parses a valid promise", () => {
    const promise = createPromise(makePromiseInput());
    expect(promise.version).toBe(1);
    expect(promise.prevHash).toBeNull();
    expect(promise.approval).toBeNull();
    expect(promise.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(PurchasePromiseSchema.safeParse(promise).success).toBe(true);
  });

  it("rejects missing buyer/merchant/amount", () => {
    expect(PurchasePromiseSchema.safeParse({}).success).toBe(false);
    const base = createPromise(makePromiseInput());
    for (const key of ["buyerId", "merchantId", "total", "items"] as const) {
      const { [key]: _dropped, ...rest } = base;
      expect(PurchasePromiseSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("rejects non-positive totals and empty items", () => {
    const input = makePromiseInput({
      total: { currency: "USD", amountMinor: -1 },
    });
    expect(() =>
      createPromise({ ...input, items: [] }),
    ).toThrow();
    expect(() => createPromise(input)).toThrow();
  });
});

describe("canonical JSON + fingerprint", () => {
  it("canonicalize is stable across key order", () => {
    const a = canonicalize({ b: 1, a: { d: 4, c: [3, 2] } });
    const b = canonicalize({ a: { c: [3, 2], d: 4 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":[3,2],"d":4},"b":1}');
  });

  it("fingerprint is stable across key order", () => {
    const input = makePromiseInput();
    const shuffled = createPromise({
      total: input.total,
      id: input.id,
      items: input.items,
      buyerId: input.buyerId,
      createdAt: input.createdAt,
      evidenceRequirements: input.evidenceRequirements,
      expectedDeliveryDate: input.expectedDeliveryDate,
      intentId: input.intentId,
      merchantId: input.merchantId,
      offerId: input.offerId,
      resolutionPolicy: input.resolutionPolicy,
      tolerances: input.tolerances,
      validUntil: input.validUntil,
    });
    expect(fingerprint(createPromise(input))).toBe(fingerprint(shuffled));
  });

  it("detects tampering with any committed field", () => {
    const promise = createPromise(makePromiseInput());
    expect(verifyIntegrity(promise)).toBe(true);
    expect(
      verifyIntegrity({
        ...promise,
        total: { currency: "USD", amountMinor: 999999 },
      }),
    ).toBe(false);
    expect(verifyIntegrity({ ...promise, merchantId: "mallory" })).toBe(false);
    expect(verifyIntegrity({ ...promise, version: 2 })).toBe(false);
  });
});

describe("versioning + approval binding", () => {
  it("material change bumps version, chains hash, invalidates approval", () => {
    const v1 = createPromise(makePromiseInput());
    const approved = attachApproval(
      v1,
      makeApproval(v1.id, v1.version, v1.hash),
    );
    const result = proposeChange(
      approved,
      {
        total: { currency: "USD", amountMinor: 3000 },
        items: [
          {
            name: "Widget",
            quantity: 1,
            unitPrice: { currency: "USD", amountMinor: 3000 },
          },
        ],
      },
      T1,
    );
    expect(result.materialChange).toBe(true);
    expect(result.approvalInvalidated).toBe(true);
    expect(result.promise.version).toBe(2);
    expect(result.promise.prevHash).toBe(v1.hash);
    expect(result.promise.approval).toBeNull();
    expect(verifyIntegrity(result.promise)).toBe(true);
  });

  it("merchant swap and delivery-date change are material", () => {
    const v1 = createPromise(makePromiseInput());
    expect(
      proposeChange(v1, { merchantId: "merchant_other" }, T1).materialChange,
    ).toBe(true);
    expect(
      proposeChange(v1, { expectedDeliveryDate: FUTURE }, T1).materialChange,
    ).toBe(true);
  });

  it("non-material change keeps approval rebound to the new version", () => {
    const v1 = createPromise(makePromiseInput());
    const approved = attachApproval(
      v1,
      makeApproval(v1.id, v1.version, v1.hash),
    );
    const result = proposeChange(
      approved,
      { tolerances: { maxDelayDays: 5, maxPriceDriftBps: 100 } },
      T1,
    );
    expect(result.materialChange).toBe(false);
    expect(result.approvalInvalidated).toBe(false);
    expect(result.promise.approval).not.toBeNull();
    expect(result.promise.approval?.promiseVersion).toBe(2);
    expect(result.promise.approval?.promiseHash).toBe(result.promise.hash);
    expect(verifyIntegrity(result.promise)).toBe(true);
  });

  it("refuses to change a promise with a broken hash", () => {
    const v1 = createPromise(makePromiseInput());
    const tampered = { ...v1, merchantId: "mallory" };
    expect(() =>
      proposeChange(tampered, { validUntil: FUTURE }, T1),
    ).toThrow();
  });

  it("attachApproval rejects cross-version and cross-promise approvals", () => {
    const v1 = createPromise(makePromiseInput());
    const v2 = proposeChange(v1, { validUntil: FUTURE }, T1).promise;
    expect(() =>
      attachApproval(v2, makeApproval(v1.id, v1.version, v1.hash)),
    ).toThrow();
    expect(() =>
      attachApproval(v1, makeApproval("other_promise", 1, v1.hash)),
    ).toThrow();
  });
});
