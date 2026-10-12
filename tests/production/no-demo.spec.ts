import { test, expect } from "@playwright/test";
test("Production with no project fails closed and exposes no demo login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your workspace is being connected" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore as Manager" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Sign in with Google" }),
  ).toBeDisabled();
  await page.goto("/app/products");
  await expect(
    page.getByRole("heading", { name: "Your workspace is being connected" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
});
