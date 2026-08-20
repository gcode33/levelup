import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  seedProfile,
  seedRoadmap,
} from "./helpers";

const TEST_EMAIL = `loop-${Date.now()}@example.com`;
const TEST_PASSWORD = "e2e-password-123!";
let userId: string | undefined;

const fixtureLevels = [
  {
    index: 0,
    title: "Level One",
    description: "First level",
    lessons: [{ title: "Intro", content: "Learn the basics", key_points: ["a"] }],
    quiz: [
      {
        question: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        answer_index: 1,
        explanation: "4",
      },
      {
        question: "Capital of France?",
        options: ["London", "Paris", "Berlin", "Rome"],
        answer_index: 1,
        explanation: "Paris",
      },
    ],
    study_sheet: "Key takeaways for level one.",
    projects: [{ title: "Build X", description: "Build something", skills_used: ["React"] }],
  },
  {
    index: 1,
    title: "Level Two",
    description: "Second level",
    lessons: [{ title: "Next", content: "More learning", key_points: ["b"] }],
    quiz: [],
    study_sheet: "",
    projects: [],
  },
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

test("a user can pass a quiz and see the study sheet", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").first().fill(TEST_EMAIL);
  await page.getByPlaceholder("Password").first().fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByText("What is 2+2?")).toBeVisible();

  await page.locator("input[name='q-0'][value='1']").click();
  await page.locator("input[name='q-1'][value='1']").click();
  await page.getByRole("button", { name: "Submit quiz" }).click();

  await expect(page.getByText(/Passed/)).toBeVisible();
  await expect(page.getByText("Key takeaways for level one.")).toBeVisible();
});
