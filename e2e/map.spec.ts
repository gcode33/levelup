import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  seedProfile,
  seedRoadmap,
} from "./helpers";

const TEST_EMAIL = `map-${Date.now()}@example.com`;
const TEST_PASSWORD = "e2e-password-123!";
let userId: string | undefined;

const fixtureLevels = [
  { index: 0, title: "Master the Basics", description: "Core concepts" },
  { index: 1, title: "Build Real Projects", description: "Apply your skills" },
  { index: 2, title: "Lead & Mentor", description: "Senior-level leadership" },
];

test.beforeAll(async () => {
  const user = await createTestUser(TEST_EMAIL, TEST_PASSWORD);
  userId = user.id;
  await seedProfile(user.id);
  await seedRoadmap(user.id, fixtureLevels);
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("the roadmap renders as an interactive map", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").first().fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  const map = page.locator(".react-flow");
  await expect(map).toBeVisible();
  await expect(map.getByText("Master the Basics")).toBeVisible();
  await expect(map.getByText("Build Real Projects")).toBeVisible();
});
