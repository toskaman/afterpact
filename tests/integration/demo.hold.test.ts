import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

/**
 * Hold scenario: a promise WITHOUT approval must never reach payment.
 * The deterministic policy evaluates to Hold/approval-missing (real
 * evaluate() execution surfaced via the promise view), the order attempt
 * is refused, and no order exists afterwards. Nothing is fabricated: the
 * scenario asserts the verdict the policy engine actually returned.
 */

function mockEnv(extra: Record<string, string> = {}): Record<string, string | undefined> {
  return {
    ...process.env,
    PAYPAL_CLIENT_ID: "",
    PAYPAL_CLIENT_SECRET: "",
    PAYPAL_MODE: "sandbox",
    CHANNEL3_API_KEY: "",
    VULTR_INFERENCE_API_KEY: "",
    LOG_LEVEL: "silent",
    AFTERPACT_ALLOW_DEMO_RESET: "1",
    ...extra,
  };
}

async function post(base: string, path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

describe("demo scenario: hold (unapproved promise never pays)", () => {
  let app: App;
  let base = "";

  beforeAll(async () => {
    app = createApp({ dataDir: ":memory:", webDir: null, processEnv: mockEnv() });
    const port = await app.listen(0);
    base = `http://localhost:${port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("completes with a real Hold verdict and refuses the order", async () => {
    const { status, json } = await post(base, "/api/demo/run", { scenario: "hold", label: "test-hold" });
    expect(status).toBe(201);
    const run = json.data as {
      id: string;
      scenario: string;
      status: string;
      context: Record<string, string>;
      acts: { act: number; status: string; detail: string; refIds: Record<string, string> }[];
      resetToken: string;
    };
    expect(run.scenario).toBe("hold");
    expect(run.status).toBe("completed");
    expect(run.resetToken).toMatch(/^[0-9a-f]{64}$/);

    const promiseId = run.context["promiseId"];
    expect(promiseId).toBeTruthy();

    // Act 1 records the verdict the policy engine actually returned.
    expect(run.acts).toHaveLength(2);
    const verdictAct = run.acts[0]!;
    expect(verdictAct.status).toBe("passed");
    expect(verdictAct.detail).toContain("Hold");
    expect(verdictAct.detail).toContain("approval-missing");

    // Act 2 is the refused order attempt: blocked, never executed.
    const orderAct = run.acts[1]!;
    expect(orderAct.status).toBe("blocked");
    expect(orderAct.detail).toMatch(/refused|blocked|missing|state/i);

    // Independent re-read: the stored promise still shows Hold, with no
    // approval attached and no order ever created for it.
    const viewRes = await fetch(`${base}/api/promises/${promiseId}`);
    expect(viewRes.status).toBe(200);
    const view = ((await viewRes.json()) as any).data as {
      promise: { approval: unknown };
      policy: { verdict: string; reasons: string[] };
      orderIds: string[];
    };
    expect(view.policy.verdict).toBe("Hold");
    expect(view.policy.reasons).toContain("approval-missing");
    expect(view.promise.approval).toBeNull();
    expect(view.orderIds).toEqual([]);
  });

  it("resets exactly the hold run's records", async () => {
    const { json } = await post(base, "/api/demo/run", { scenario: "hold", label: "test-hold-reset" });
    const run = json.data as { id: string; context: Record<string, string>; resetToken: string };
    const reset = await post(base, `/api/demo/runs/${run.id}/reset`, { token: run.resetToken });
    expect(reset.status).toBe(200);
    expect(reset.json.data.cleared["promises"]).toBe(1);
    expect(reset.json.data.cleared["intents"]).toBe(1);
    const viewRes = await fetch(`${base}/api/promises/${run.context["promiseId"]}`);
    expect(viewRes.status).toBe(404);
  });
});
