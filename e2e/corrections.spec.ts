import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { publishedTitle } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the correction policy page explains what can change @smoke", async ({ page }) => {
  await page.goto("/corrections");
  await expect(page.getByRole("heading", { name: "Correction policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What we do not change" })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
});

test("a signed-out rights holder requests a correction from a title page", async ({ page }) => {
  const slug = await publishedTitle("e2e-fix");
  await page.goto(`/titles/${slug}`);
  await page.getByRole("link", { name: "Request a correction" }).click();
  await page.waitForURL(new RegExp(`/titles/${slug}/correction$`));
  await expect(page.getByRole("heading", { name: "Request a correction" })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);

  await page.getByLabel("Your name or organisation").fill("Example Studio Legal");
  await page.getByLabel("Email for our reply").fill("not an email");
  await page.getByLabel("What is wrong, and what is right?").fill("short");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Check the highlighted fields.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address so we can reply.")).toBeVisible();

  await page.getByLabel("Email for our reply").fill(`legal+${Date.now()}@studio.example`);
  await page.getByLabel("Your connection to this title").selectOption("rights_holder");
  await page.getByLabel("What is wrong, and what is right?").fill("No generative AI was used anywhere in this production.");
  await page.getByLabel("Link to evidence (optional)").fill("https://studio.example/statement");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toHaveText(/Your request is with our moderators/);
});
