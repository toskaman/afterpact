import { expect, test } from "@playwright/test";
import { collectPageErrors, seedIncident } from "./seed";

test("studio canvas mounts with live sources and trial pill", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  await seedIncident(request);
  await page.goto("/#/studio");
  const host = page.locator("#agStudioHost");
  await expect(host).toBeVisible();
  // Canvas mounts (or degrades with an honest message, never a blank crash).
  await expect(host).not.toBeEmpty({ timeout: 30000 });
  await expect(page.locator("#studioLicensePill")).toContainText("TRIAL");
  await expect(page.getByText("AI Assistant").first()).toBeVisible({ timeout: 30000 });
  // The custom Outcome Risk Analyst agent (not the base harness) must win
  // against the real bundle — keyless mount still builds the full harness.
  await expect(host).toHaveAttribute("data-harness-kind", "outcome-risk-analyst", { timeout: 30000 });
  await expect(page.locator("html[data-ag-theme-mode]")).toHaveCount(1);
  expect(errors).toEqual([]);
});
