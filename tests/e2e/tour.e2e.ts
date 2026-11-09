import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./seed";

test("landing funnels visitors to the 60-second story", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/");
  const link = page.locator("[data-landing-tour-link] a");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "#/judge");
  await link.click();
  await expect(page.getByRole("heading", { name: "A successful payment is not a successful purchase." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("judge tour plays Recover Hold Refuse with proof links", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await expect(page.locator("[data-tour-step]")).toHaveCount(3);
  await page.getByRole("button", { name: "Play the 60-second story" }).click();
  await expect(page.locator('[data-tour-step="flagship"]')).toHaveAttribute("data-state", "done", { timeout: 60000 });
  await expect(page.locator('[data-tour-step="hold"]')).toHaveAttribute("data-state", "done", { timeout: 60000 });
  await expect(page.locator('[data-tour-step="injection"]')).toHaveAttribute("data-state", "done", { timeout: 60000 });
  const finale = page.locator("[data-tour-finale]");
  await expect(finale).toBeVisible();
  await expect(finale).toContainText("3/3 steps");
  // Each of the three real executions keeps its own proof links.
  await expect(finale.locator('a[href^="#/twin?promiseId="]')).toHaveCount(3);
  await expect(finale.locator('a[href^="#/recorder?promiseId="]')).toHaveCount(3);
  // No failures: hold and injection are blocked-by-design, reported honestly.
  expect(errors).toEqual([]);
});

test("judge result offers copy buttons and one-click reset", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await page.locator('[data-scenario-card="hold"] button').click();
  await expect(page.locator("[data-judge-acts]").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole("button", { name: "Copy run id" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy promise id" })).toBeVisible();
  await page.getByRole("button", { name: "Reset this run" }).click();
  await page.locator("#confirmOk").click();
  await expect(page.locator("#toasts")).toContainText("Run reset:", { timeout: 15000 });
  expect(errors).toEqual([]);
});
