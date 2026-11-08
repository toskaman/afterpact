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
  expect(errors).toEqual([]);
});
