import { describe, expect, it } from "vitest";
import { createApp, type App } from "../../apps/api/src/routes";

function mockEnv(extra: Record<string, string> = {}): Record<string, string | undefined> {
  return {
    ...process.env,
    PAYPAL_CLIENT_ID: "",
    PAYPAL_CLIENT_SECRET: "",
    PAYPAL_MODE: "sandbox",
    AG_STUDIO_LICENSE_KEY: "",
    LOG_LEVEL: "silent",
    ...extra,
  };
}

async function getConfig(extra: Record<string, string>): Promise<any> {
  const app: App = createApp({ dataDir: ":memory:", webDir: null, processEnv: mockEnv(extra) });
  const port = await app.listen(0);
  try {
    const res = await fetch(`http://localhost:${port}/api/config`);
    expect(res.status).toBe(200);
    return ((await res.json()) as any).data;
  } finally {
    await app.close();
  }
}

describe("AG Studio consent kill-switch (T3 sponsors)", () => {
  it("enables the Studio canvas by default", async () => {
    const config = await getConfig({});
    expect(config.agStudio.enabled).toBe(true);
  });

  it("disables the Studio canvas with AG_STUDIO_DISABLED=1", async () => {
    const config = await getConfig({ AG_STUDIO_DISABLED: "1" });
    expect(config.agStudio.enabled).toBe(false);
  });

  it("reports unlicensed (watermark path) with no key", async () => {
    const config = await getConfig({});
    expect(config.agStudio.licensed).toBe(false);
    expect(config.agStudio.licenseKey).toBeNull();
  });

  it("passes a deploy-time key through to the client installer", async () => {
    // Fake key: asserts plumbing only (AG licence keys install client-side
    // by design via AgStudioLicenseManager.setLicenseKey; real keys never
    // touch the repo — deploy-time env, see ag-studio-trial.md).
    const config = await getConfig({ AG_STUDIO_LICENSE_KEY: "TEST-STUDIO-KEY" });
    expect(config.agStudio.enabled).toBe(true);
    expect(config.agStudio.licensed).toBe(true);
    expect(config.agStudio.licenseKey).toBe("TEST-STUDIO-KEY");
  });
});
