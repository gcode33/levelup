import { test, expect } from "@playwright/test";

test("homepage renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Create Next App");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
