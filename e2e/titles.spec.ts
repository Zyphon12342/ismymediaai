import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { deleteTitle, signIn, trustedUser } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe.configure({ mode: "serial" });

test("add a film from the catalogue, then find it by browsing", async ({ page }) => {
  await deleteTitle("tmdb", "movie/900001");
  const u = await trustedUser("adder");
  await signIn(page, u.email, u.password, "/titles/new");
  await expect(page.getByRole("heading", { name: "Add a title" })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);

  await page.getByLabel("Title to look up").fill("sample film");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Select The Sample Film (2031)" }).click();
  await expect(page.getByText("A projectionist finds a reel")).toBeVisible();
  // Genres are prefilled from the catalogue.
  await expect(page.getByRole("checkbox", { name: "Drama" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Sci-fi" })).toBeChecked();
  await page.getByRole("button", { name: "Add title" }).click();

  await expect(page).toHaveURL(/\/titles\/the-sample-film-2031/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Is The Sample Film (2031) AI-generated?");
  await expect(page.getByTestId("verdict")).toHaveText(/No community votes yet/);
  await expect(page.getByText("Cleo Director")).toBeVisible();
  await expect(page.getByText("Ada Placeholder (Projectionist)", { exact: false })).toBeVisible();
  await expect(page).toHaveTitle("Is The Sample Film (2031) AI-generated? Community verdict | isMyMediaAI");
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);

  // Searching the catalogue again shows it is already here.
  await page.goto("/titles/new");
  await page.getByLabel("Title to look up").fill("sample film");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "The Sample Film (2031)" }).getByRole("link", { name: "Already here" }),
  ).toHaveAttribute("href", /the-sample-film-2031/);

  await page.goto("/?kind=movie&genre=sci-fi");
  await expect(page.getByRole("link", { name: /The Sample Film/ })).toBeVisible();
  await page.goto("/?q=sample%20fil");
  await expect(page.getByRole("link", { name: /The Sample Film/ })).toBeVisible();
});

test("browse page is accessible @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("search")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
});

test("new accounts are told when they can add titles", async ({ page }) => {
  const u = await trustedUser("fresh", 0);
  await signIn(page, u.email, u.password, "/titles/new");
  await expect(page.getByText(/New accounts can add titles 72 hours after signing up/)).toBeVisible();
});

test("a manual entry waits for review", async ({ page }) => {
  const u = await trustedUser("manual");
  await signIn(page, u.email, u.password, "/titles/new");
  await page.getByRole("radio", { name: "Book" }).check({ force: true });
  await page.getByRole("tab", { name: "Add manually" }).click();
  const title = `Hand Bound ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("checkbox", { name: "Poetry" }).check({ force: true });
  await page.getByRole("button", { name: "Add a credit" }).click();
  await page.getByLabel("Name 1").fill("Some Poet");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("waiting for a moderator")).toBeVisible();
});

test("vote on a title, change it, and see it on your profile", async ({ page }) => {
  await deleteTitle("tmdb", "tv/910001");
  const u = await trustedUser("voter");
  await signIn(page, u.email, u.password, "/titles/new");
  await page.getByRole("radio", { name: "TV show" }).check({ force: true });
  await page.getByLabel("Title to look up").fill("example street");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Select Example Street/ }).click();
  await page.getByRole("button", { name: "Add title" }).click();
  await expect(page).toHaveURL(/\/titles\/example-street-2030/);

  const group = page.getByRole("group", { name: "Your vote" });
  await group.getByRole("button", { name: "Uses gen AI" }).click();
  await expect(group.getByRole("button", { name: "Uses gen AI" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("verdict")).toHaveText(/Too few votes for a community verdict yet: 1 vote so far/);
  await group.getByRole("button", { name: "No gen AI" }).click();
  await expect(group.getByRole("button", { name: "No gen AI" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Uses gen AI" })).toHaveAttribute("aria-pressed", "false");

  await page.goto(`/u/${u.handle}?tab=votes`);
  await expect(page.getByText("Only you can see this list.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Example Street/ })).toBeVisible();
});

test("signed-out visitors are asked to sign in to vote", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("main ul li a").first();
  if ((await first.count()) === 0) test.skip();
  await first.click();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  await expect(page.getByText("to vote.")).toBeVisible();
});
