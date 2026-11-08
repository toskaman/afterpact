import { defineConfig } from "@playwright/test";

/** Browser E2E: built API + static SPA, mock transport, no keys. */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3111",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node apps/api/dist/apps/api/src/index.js",
    port: 3111,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: "3111",
      AFTERPACT_DATA_DIR: ":memory:",
      LOG_LEVEL: "silent",
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
