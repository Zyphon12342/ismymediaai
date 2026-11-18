import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Cloudflare sets CF-IPCountry in front of the site; here the test sets it.
test.describe("cookie consent in the EU", () => {
  test.use({ extraHTTPHeaders: { "cf-ipcountry": "DE" } });

  test("asks first, remembers the choice, and can be changed", async ({ page, context }) => {
    await page.goto("/");
    const settings = page.getByRole("button", { name: "Cookie settings" });
    test.skip((await settings.count()) === 0, "PostHog is not configured in this build");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await expect(banner).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);

    await banner.getByRole("button", { name: "Accept" }).click();
    await expect(banner).toBeHidden();
    expect((await context.cookies()).find((c) => c.name === "mm_consent")?.value).toBe("granted");

    await page.reload();
    await expect(banner).toBeHidden();

    await settings.click();
    await banner.getByRole("button", { name: "Reject" }).click();
    await expect(banner).toBeHidden();
    expect((await context.cookies()).find((c) => c.name === "mm_consent")?.value).toBe("denied");
  });
});

test.describe("cookie consent elsewhere", () => {
  test.use({ extraHTTPHeaders: { "cf-ipcountry": "US" } });

  test("shows no banner but keeps the settings link", async ({ page }) => {
    await page.goto("/");
    test.skip((await page.getByRole("button", { name: "Cookie settings" }).count()) === 0, "PostHog is not configured in this build");
    await expect(page.getByRole("region", { name: "Cookie consent" })).toBeHidden();
  });
});

test("privacy page names the analytics tools @smoke", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByText("PostHog", { exact: true }).first()).toBeVisible();
});
