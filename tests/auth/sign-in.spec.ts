import { test, expect, type Page } from "@playwright/test";
import type { Account, Role } from "../../src/domain/types";

const user = {
  id: "10000000-0000-4000-8000-000000000003",
  email: "owner@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "New Owner" },
  created_at: "2026-10-12T00:00:00Z",
};
const account: Account = {
  id: "20000000-0000-4000-8000-000000000001",
  store_id: "30000000-0000-4000-8000-000000000001",
  user_id: user.id,
  email: user.email,
  name: "New Owner",
  role: "manager",
  active: true,
  created_at: user.created_at,
};

async function seedSession(page: Page, role: Role) {
  await page.goto("/");
  await page.evaluate(
    ({ user, role }) => {
      localStorage.setItem(
        "sb-smartpos-auth-auth-token",
        JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      );
      sessionStorage.setItem("smartpos-login-role", role);
    },
    { user, role },
  );
}

test.beforeEach(async ({ page }) => {
  // Every request to the fake Supabase host is intercepted; no real accounts are used.
  await page.route("https://smartpos-auth.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/v1/authorize") {
      await route.fulfill({
        contentType: "text/html",
        body: "<h1>Google sign-in test</h1>",
      });
    } else if (path === "/rest/v1/stores") {
      await route.fulfill({
        json: {
          id: account.store_id,
          name: "My store",
          currency: "PHP",
          timezone: "Asia/Manila",
          receipt_note: "Thank you!",
        },
      });
    } else if (path === "/rest/v1/accounts") {
      await route.fulfill({ json: [account] });
    } else if (path === "/auth/v1/user") {
      await route.fulfill({ json: user });
    } else {
      await route.fulfill({ json: [] });
    }
  });
});

for (const role of ["manager", "cashier"] as const) {
  test(`chooses ${role} before Google OAuth and retains the choice`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Sign in with Google" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Sign in to SmartPOS" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Your Manager must add your Google email first",
    );
    await dialog
      .getByRole("button", {
        name: role === "manager" ? /^Manager/ : /^Cashier/,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Google sign-in test" }),
    ).toBeVisible();
    const oauth = new URL(page.url());
    expect(oauth.searchParams.get("provider")).toBe("google");
    expect(oauth.searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:5180/auth/callback",
    );
    await page.goto("/");
    expect(
      await page.evaluate(() => sessionStorage.getItem("smartpos-login-role")),
    ).toBe(role);
  });
}

test("Manager callback claims the selected role, opens the store, and restores the session on reload", async ({
  page,
}) => {
  const claims: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/rpc/claim_account", async (route) => {
    claims.push(route.request().postDataJSON());
    await route.fulfill({ json: account });
  });
  await seedSession(page, "manager");
  await page.goto("/auth/callback");
  await expect(
    page.getByRole("heading", { name: "Store overview" }),
  ).toBeVisible();
  expect(claims).toContainEqual({ p_role: "manager" });
  expect(
    await page.evaluate(() => sessionStorage.getItem("smartpos-login-role")),
  ).toBeNull();
  await expect(
    page.getByRole("link", { name: "Cashiers", exact: true }),
  ).toBeVisible();
  claims.length = 0;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Store overview" }),
  ).toBeVisible();
  expect(claims).toContainEqual({});
});

test("Cashier callback uses the assigned account and hides Manager navigation", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/claim_account", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_role: "cashier" });
    await route.fulfill({
      json: { ...account, role: "cashier", name: "New Cashier" },
    });
  });
  await seedSession(page, "cashier");
  await page.goto("/auth/callback");
  await expect(page.getByRole("heading", { name: "Hello, New" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Cashiers", exact: true }),
  ).toHaveCount(0);
});

test("an unapproved Cashier sees the invitation error and can choose another role", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/claim_account", async (route) => {
    await route.fulfill({
      status: 403,
      json: {
        code: "42501",
        message: "Ask your store Manager to add your email as a Cashier",
      },
    });
  });
  await seedSession(page, "cashier");
  await page.goto("/auth/callback");
  await expect(page.getByRole("alert")).toContainText(
    "add your email as a Cashier",
  );
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sign in with Google" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Sign in to SmartPOS" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
