/** Replacement marker for redacted secret values. */
export const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERN =
  /secret|passwd|password|credential|authorization|private[\s_-]?key|clientsecret|webhooksecret|accesstoken|refreshtoken/i;
const TOKEN_KEY_PATTERN = /(^|[_.:-])token($|[_.:-])/i;

/**
 * True when an object key (or header name) plausibly holds a secret.
 * Deliberately broad: an unrecognized secret-shaped key must fail closed
 * into redaction rather than leak. Plain words like "author" do NOT match.
 */
export function isSecretKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (k === "auth" || k === "authn" || k === "authz") return true;
  return SECRET_KEY_PATTERN.test(k) || TOKEN_KEY_PATTERN.test(k);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const CREDENTIAL_URL_PATTERN = /(\b[a-z][a-z0-9+.-]*:\/\/[^/\s:]+:)([^@/\s]+)(@)/i;

/** Redact embedded `user:password@` credentials inside URL strings. */
export function redactUrlCredentials(text: string): string {
  return text.replace(CREDENTIAL_URL_PATTERN, `$1${REDACTED}$3`);
}

const MAX_DEPTH = 25;

/**
 * Deep-clone a value with secret-shaped keys replaced by [REDACTED].
 * Non-plain objects (Date, class instances) pass through by reference;
 * only plain data needs redaction for logs and audit payloads.
 */
export function redactValue<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === "string") return redactUrlCredentials(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = isSecretKey(key)
        ? REDACTED
        : redactValue(entry, depth + 1);
    }
    return out as T;
  }
  return value;
}

/** Redact a header map (lookup is by header name, case-insensitive). */
export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = isSecretKey(key) ? REDACTED : value;
  }
  return out;
}

/** Redacted JSON for structured logs. Never throws on circular input. */
export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(redactValue(value));
  } catch {
    return JSON.stringify({ redacted: "unserializable-value" });
  }
}

