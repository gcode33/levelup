import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, seedProfile } from "./helpers";

const TEST_EMAIL = `jobs-${Date.now()}@example.com`;
const TEST_PASSWORD = "e2e-password-123!";
let userId: string | undefined;

test.beforeAll(async () => {
  const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD);
  userId = user.id;
  await seedProfile(user.id);
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("jobs matched to progress appear on the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").first().fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Jobs you're ready for")).toBeVisible();
  await expect(page.getByText("Junior Frontend Developer")).toBeVisible();
});
