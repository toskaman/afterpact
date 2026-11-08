import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./seed";

test("ai gallery renders recorded runs with no live-inference claims", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/ai-gallery");
  await expect(page.locator("h1")).toContainText("AI Evidence Gallery");
  await expect(page.getByText("RECORDED VERIFIED AI RUN").first()).toBeVisible();
  await expect(page.getByText("NO INFERENCE ON THIS PAGE")).toBeVisible();
  await expect(page.locator(".grid.kpi")).toContainText("117/120");
  await expect(page.getByText("deepseek-v4.1-flash-1017").first()).toBeVisible();
  // Task filter narrows the featured list (2 recovery outcomes featured).
  await page.selectOption("#galleryTask", "recovery");
  await expect(page.getByText("recovery-short-delivery")).toBeVisible();
  await expect(page.getByText("recovery-full-loss")).toBeVisible();
  await expect(page.getByText("intent-simple")).toHaveCount(0);
  expect(errors).toEqual([]);
});
