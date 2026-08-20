import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./helpers";

const TEST_EMAIL = `pers-${Date.now()}@example.com`;
const TEST_PASSWORD = "e2e-password-123!";
let userId: string | undefined;

test.beforeAll(async () => {
  const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD);
  userId = user.id;
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("theme preference is applied", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").first().fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
