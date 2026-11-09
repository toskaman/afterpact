import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./seed";

test("judge mode entry explains the product in one screen", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await expect(page.getByRole("heading", { name: "A successful payment is not a successful purchase." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run the flagship scenario" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the evidence" })).toBeVisible();
  await expect(page.locator("[data-scenario-card]")).toHaveCount(4);
  await expect(page.getByText("Promise → Payment → Observation → Recovery → Proof")).toBeVisible();
  await expect(page.getByText("Recover, Hold, and Refuse are three real policy outcomes")).toBeVisible();
  // SPA route change moves focus to the main landmark for keyboard/SR users.
  await expect(page.locator("#main")).toBeFocused();
  expect(errors).toEqual([]);
});

test("judge mode runs the flagship scenario with a guided sequence", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await page.getByRole("button", { name: "Run the flagship scenario" }).click();
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

test("judge mode holds the unapproved promise with no order record", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/judge");
  await page.locator('[data-scenario-card="hold"] button').click();
  const acts = page.locator("[data-judge-acts]").first();
  await expect(acts).toBeVisible({ timeout: 60000 });
  await expect(acts).toContainText("Hold");
  await expect(acts).toContainText("approval-missing");
  await expect(page.locator("[data-judge-acts] [data-act-status='blocked']").first()).toBeVisible();
  // The Twin link proves the stored promise still shows Hold with no order.
  const twinHref = await page.locator('a[href^="#/twin?promiseId="]').first().getAttribute("href");
  expect(twinHref).toBeTruthy();
  const promiseId = (twinHref as string).split("promiseId=")[1];
  const view = ((await (await request.get(`/api/promises/${promiseId}`)).json()) as any).data;
  expect(view.policy.verdict).toBe("Hold");
  expect(view.orderIds).toEqual([]);
  expect(errors).toEqual([]);
});

test("judge mode stays usable on a mobile viewport with keyboard input", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/judge");
  await expect(page.getByRole("heading", { name: "A successful payment is not a successful purchase." })).toBeVisible();
  await expect(page.locator("[data-scenario-card]")).toHaveCount(4);
  // Keyboard-only path: tab to the hold button and run it via keyboard.
  await page.locator('[data-scenario-card="hold"] button').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-judge-acts]").first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-judge-acts] [data-act-status='blocked']").first()).toBeVisible();
  expect(errors).toEqual([]);
});
