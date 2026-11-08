import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Committed live-sandbox receipt artifact. The loop was executed against
 * api-m.sandbox.paypal.com; this file pins the provider-confirmed
 * outcome (ids, statuses, amounts) so docs can cite it without
 * re-running money movement. The recorder reads creds from the local
 * gitignored APIS.txt and stores only whitelisted fields.
 */
describe("paypal live receipts artifact", () => {
  const path = join(REPO_ROOT, "docs", "demo", "paypal-live-receipts.json");

  it("pins the provider-confirmed sandbox loop", () => {
    expect(existsSync(path)).toBe(true);
    const receipts = JSON.parse(readFileSync(path, "utf8"));
    expect(receipts.provider).toBe("api-m.sandbox.paypal.com");
    expect(receipts.order.id).toBe("2ER387580K033722V");
    expect(receipts.order.status).toBe("COMPLETED");
    expect(receipts.capture.id).toBe("7R158417X9367771B");
    expect(receipts.capture.status).toBe("PARTIALLY_REFUNDED");
    expect(receipts.capture.amount).toEqual({ currency: "USD", amountMinor: 38997 });
    expect(receipts.refund.id).toBe("8DJ895035B173303G");
    expect(receipts.refund.status).toBe("COMPLETED");
    expect(receipts.refund.amount).toEqual({ currency: "USD", amountMinor: 12999 });
    expect(receipts.refund.partial).toBe(true);
    expect(typeof receipts.fetchedAt).toBe("string");
    // No secrets may ever land in the artifact.
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toMatch(/client_secret|Basic [A-Za-z0-9+/=]{20,}|Bearer [A-Za-z0-9._-]{20,}/);
  });
});
