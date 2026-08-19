import { test, expect } from "@playwright/test";

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("LevelUp");
});

test("login page renders sign in and sign up forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  await expect(page.getByPlaceholder("Email").first()).toBeVisible();
});

test("sign in with invalid credentials shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").first().fill("nobody@example.com");
  await page.getByPlaceholder("Password").first().fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
});
