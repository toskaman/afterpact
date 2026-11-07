import { createHash } from "node:crypto";

/** Recursively key-sorted stable JSON. Object key order never affects output. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    for (const [k, v] of entries) out[k] = sortValue(v);
    return out;
  }
  return value;
}

/** Lowercase sha256 hex of a UTF-8 string. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** sha256 hex of the canonical form of a value. */
export function fingerprintOf(value: unknown): string {
  return sha256Hex(canonicalize(value));
}
