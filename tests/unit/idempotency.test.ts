import { describe, expect, it } from "vitest";
import {
  generateKey,
  IdempotencyStore,
  InvalidIdempotencyKeyError,
  parseKey,
} from "../../packages/domain/src/index";

describe("idempotency keys", () => {
  it("generates scoped keys that parse", () => {
    const key = generateKey("order-create");
    expect(key.startsWith("order-create_")).toBe(true);
    expect(parseKey(key)).toBe(key);
  });

  it("rejects malformed scopes and keys", () => {
    expect(() => generateKey("!!!")).toThrow(InvalidIdempotencyKeyError);
    expect(() => parseKey("short")).toThrow(InvalidIdempotencyKeyError);
    expect(() => parseKey("has space in it ok?")).toThrow(
      InvalidIdempotencyKeyError,
    );
    expect(() => parseKey("")).toThrow(InvalidIdempotencyKeyError);
  });

  it("first claim wins; replays are duplicates", () => {
    const store = new IdempotencyStore();
    const key = generateKey("refund");
    expect(store.claim(key, "op_1")).toBe("claimed");
    expect(store.claim(key, "op_2")).toBe("duplicate");
    expect(store.ownerOf(key)).toBe("op_1");
    expect(store.size).toBe(1);
  });
});
