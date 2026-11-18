import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { authLinkFor, signUp, uniqueHandle } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("sign-in page renders @smoke", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

for (const path of ["/sign-in", "/sign-up", "/forgot-password"]) {
  test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("sign up, verify by email, edit profile, show votes, sign out, sign back in", async ({ page, baseURL }) => {
  const handle = uniqueHandle("e2e");
  const password = `pw-${crypto.randomUUID()}`;
  const email = await signUp(page, handle, password);

  // Unverified accounts cannot sign in yet.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Verify your email first.")).toBeVisible();

  // The emailed link verifies, signs in and lands on settings.
  await page.goto(await authLinkFor(email, baseURL!));
  await expect(page).toHaveURL(/\/settings\/profile\?welcome=1/);
  await expect(page.getByText("Your email is verified")).toBeVisible();
  await expect(page.getByRole("link", { name: `@${handle}` })).toBeVisible();

  await page.getByLabel("Display name").fill("End To End");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.goto(`/u/${handle}`);
  await expect(page.getByRole("heading", { level: 1, name: "End To End" })).toBeVisible();
  await expect(page.getByRole("main").getByText(`@${handle}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/Member since/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(axe.violations).toEqual([]);

  const toggle = page.getByRole("switch", { name: "Show my votes" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // Votes tab is public now that show_votes is on.
  await page.goto(`/u/${handle}?tab=votes`);
  await expect(page.getByText("No votes yet.")).toBeVisible();

  await page.goto(`/sign-in?next=/u/${handle}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`nobody_${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password do not match.")).toBeVisible();
});

test("password reset by email", async ({ page, baseURL }) => {
  const handle = uniqueHandle("reset");
  const password = `pw-${crypto.randomUUID()}`;
  const email = await signUp(page, handle, password);
  await page.goto(await authLinkFor(email, baseURL!));
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("we sent it a link")).toBeVisible();

  await expect.poll(async () => (await authLinkFor(email, baseURL!)).includes("type=recovery")).toBe(true);
  await page.goto(await authLinkFor(email, baseURL!));
  await expect(page).toHaveURL(/\/reset-password/);
  const newPassword = `new-${crypto.randomUUID()}`;
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("Your password was changed.")).toBeVisible();
});

test("signed-out visitors are sent to sign in from settings", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fprofile|\/sign-in\?next=\/settings\/profile/);
});

test("unknown profiles are 404", async ({ page }) => {
  const res = await page.goto(`/u/nobody_${Date.now()}`);
  expect(res?.status()).toBe(404);
});

test("callback links cannot redirect off-site", async ({ page }) => {
  await page.goto("/auth/callback?code=bogus&next=https://evil.example/");
  await expect(page).toHaveURL(/\/auth\/error/);
  expect(new URL(page.url()).host).not.toContain("evil.example");
});
