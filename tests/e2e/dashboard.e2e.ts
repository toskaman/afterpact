import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./seed";

test("command center loads with status pills and no page errors", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/");
  await expect(page.locator("h1")).toContainText("Command Center");
  await expect(page.locator("#transportPill")).toBeVisible();
  await expect(page.locator("#chainPill")).toBeVisible();
  await expect(page.locator("#aiPill")).toBeVisible();
  // CI runs without keys: transport is mock, AI is honestly off.
  await expect(page.locator("#transportPill")).toContainText("MOCK");
  await expect(page.locator("#aiPill")).toContainText("OFF");
  expect(errors).toEqual([]);
});

test("copilot parses an intent and compares offers", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/#/copilot");
  await page.getByRole("button", { name: /parse intent/i }).click();
  await expect(page.getByText("Parsed intent")).toBeVisible();
  await page.getByRole("button", { name: /compare offers/i }).click();
  await expect(page.getByText("offers", { exact: false }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
