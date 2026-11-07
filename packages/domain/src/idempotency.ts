import { randomUUID } from "node:crypto";
import { z } from "zod";

export class InvalidIdempotencyKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdempotencyKeyError";
  }
}

/**
 * Opaque client-supplied key, `scope_token` by convention. Scopes keep
 * namespaces (orders, captures, refunds, webhooks) from colliding.
 */
export const IdempotencyKeySchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,159}$/,
    "idempotency key must be 8-160 chars of [A-Za-z0-9_.:-]",
  );
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export function generateKey(scope: string): IdempotencyKey {
  const clean = scope.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (clean.length < 1 || clean.length > 40) {
    throw new InvalidIdempotencyKeyError(
      "scope must normalize to 1-40 chars of [a-z0-9_-]",
    );
  }
  const candidate = `${clean}_${randomUUID()}`;
  const result = IdempotencyKeySchema.safeParse(candidate);
  if (!result.success) {
    throw new InvalidIdempotencyKeyError(
      result.error.issues[0]?.message ?? "generated key failed validation",
    );
  }
  return result.data;
}

export function parseKey(key: string): IdempotencyKey {
  const result = IdempotencyKeySchema.safeParse(key);
  if (!result.success) {
    throw new InvalidIdempotencyKeyError(result.error.issues[0]?.message ?? "bad key");
  }
  return result.data;
}

export type ClaimOutcome = "claimed" | "duplicate";

/**
 * In-memory idempotency registry (single process). Persistence lands behind
 * the same claim/get shape in the API layer (unique key column).
 */
export class IdempotencyStore {
  private readonly keys = new Map<string, string>();

  /** First claim wins; replays return "duplicate" with the original owner. */
  claim(key: string, owner: string): ClaimOutcome {
    const parsed = parseKey(key);
    if (this.keys.has(parsed)) return "duplicate";
    this.keys.set(parsed, owner);
    return "claimed";
  }

  ownerOf(key: string): string | undefined {
    return this.keys.get(parseKey(key));
  }

  get size(): number {
    return this.keys.size;
  }
}
