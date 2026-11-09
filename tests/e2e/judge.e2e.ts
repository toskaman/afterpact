import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./seed";

test("judge mode entry explains the product in one screen", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await expect(page.getByRole("heading", { name: "A successful payment is not a successful purchase." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Run the flagship scenario" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the evidence" })).toBeVisible();
  await expect(page.locator("[data-scenario-card]")).toHaveCount(3);
  await expect(page.getByText("Promise → Payment → Observation → Recovery → Proof")).toBeVisible();
  expect(errors).toEqual([]);
});

test("judge mode runs the flagship scenario with a guided sequence", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await page.getByRole("link", { name: "Run the flagship scenario" }).click();
  await expect(page.locator("[data-judge-acts]").first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-judge-acts] [data-act-status='passed']").first()).toBeVisible();
  await expect(page.locator('a[href^="#/twin?promiseId="]').first()).toBeVisible();
  await expect(page.locator('a[href^="#/recorder?promiseId="]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("judge mode shows the refusal path and recorded provider proof", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await page.locator('[data-scenario-card="injection"] button').click();
  await expect(page.getByText("REFUSED", { exact: false }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator('[data-scenario-card="receipts"]')).toContainText("2ER387580K033722V");
  await expect(page.locator('[data-scenario-card="receipts"]')).toContainText("59A94150344824111");
  expect(errors).toEqual([]);
});
