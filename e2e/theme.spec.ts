import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const pageBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// Dark backgrounds come out as oklch(0.14...) or rgb(9, 9, 11); light ones as oklch(1 ...) / rgb(255, 255, 255).
const isDark = (color: string) => {
  const first = Number(color.match(/[\d.]+/)?.[0] ?? NaN);
  return color.startsWith("oklch") ? first < 0.5 : first < 128;
};

test.describe("dark device setting", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device, and every public page passes WCAG AA in dark", async ({ page }) => {
    for (const path of ["/", "/sign-in", "/sign-up", "/privacy", "/corrections", "/titles/example-street-2030"]) {
      await page.goto(path);
      expect(isDark(await pageBackground(page)), path).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations, path).toEqual([]);
    }
  });

  test("Light overrides the device and is remembered; Auto goes back to following it", async ({ page, context }) => {
    await page.goto("/");
    const toggle = page.getByRole("group", { name: "Colour theme" });
    await expect(toggle.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");

    await toggle.getByRole("button", { name: "Light" }).click();
    expect(isDark(await pageBackground(page))).toBe(false);
    expect((await context.cookies()).find((c) => c.name === "mm_theme")?.value).toBe("light");
    await page.reload();
    expect(isDark(await pageBackground(page))).toBe(false);
    await expect(toggle.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");

    await toggle.getByRole("button", { name: "Auto" }).click();
    expect(isDark(await pageBackground(page))).toBe(true);
    expect((await context.cookies()).find((c) => c.name === "mm_theme")).toBeUndefined();
  });
});

test.describe("light device setting", () => {
  test.use({ colorScheme: "light" });

  test("Dark can be picked on a light device", async ({ page }) => {
    await page.goto("/");
    expect(isDark(await pageBackground(page))).toBe(false);
    await page.getByRole("group", { name: "Colour theme" }).getByRole("button", { name: "Dark" }).click();
    expect(isDark(await pageBackground(page))).toBe(true);
    await page.reload();
    expect(isDark(await pageBackground(page))).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
  });
});
