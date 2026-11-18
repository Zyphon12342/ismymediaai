import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page loads @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("not endorsed or certified by TMDB")).toBeVisible();
});

test("health check is ok @smoke", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect((await res.json()).status).toBe("ok");
});

test("home page has no WCAG 2.2 AA violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("search is in the header and stays on screen while scrolling, on a phone too", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/privacy");
  const box = page.getByRole("searchbox", { name: "Search titles" });
  await expect(box).toBeInViewport();
  await page.mouse.wheel(0, 2000);
  await expect(box).toBeInViewport();
  await box.fill("sample");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/\?q=sample/);
  await expect(page.getByText(/Results for/)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search titles" })).toHaveValue("sample");
});
