import { expect, test } from "@playwright/test";
import { collectPageErrors, seedIncident, seedVerifiedRecovery } from "./seed";

test("outcome twin renders all three realities for a verified recovery", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  const { promiseId } = await seedVerifiedRecovery(request);
  await page.goto(`/#/twin?promiseId=${promiseId}`);
  await expect(page.getByText("What was promised")).toBeVisible();
  await expect(page.getByText("What actually happened")).toBeVisible();
  await expect(page.getByText("What AFTERPACT recovered")).toBeVisible();
  await expect(page.getByText("VERIFIED REFUND").first()).toBeVisible();
  await expect(page.getByText("CHAIN VALID").first()).toBeVisible();
  await expect(page.getByText("If left unresolved")).toBeVisible();
  await expect(page.locator(".twin-divergence")).toBeVisible();
  await expect(page.getByText("DIVERGENCE").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("recovery center lists the open incident with AI actions", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  await seedIncident(request);
  await page.goto("/#/recovery");
  await expect(page.locator("h1")).toContainText("Recovery Center");
  await expect(page.locator("[data-ai-analyze]").first()).toBeVisible();
  await expect(page.locator("[data-ai-propose]").first()).toBeVisible();
  expect(errors).toEqual([]);
});
