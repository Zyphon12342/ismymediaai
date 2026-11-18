import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { totp } from "../tests/integration/totp";
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
  await expect(page.getByTestId("verdict")).toHaveText(/No verdict yet\. Be the first to vote/);
  const credits = page.getByRole("region", { name: "Credits" });
  await expect(credits.getByText("Cleo Director")).toBeVisible();
  await expect(credits.getByText("Ada Placeholder (Projectionist)", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Questions" }).getByText("Did The Sample Film (2031) use generative AI?")).toBeVisible();
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
  await expect(page.getByTestId("verdict")).toHaveText(/No verdict yet: 1 vote so far/);
  await group.getByRole("button", { name: "No gen AI" }).click();
  await expect(group.getByRole("button", { name: "No gen AI" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Uses gen AI" })).toHaveAttribute("aria-pressed", "false");

  await page.goto(`/u/${u.handle}?tab=votes`);
  await expect(page.getByText("Only you can see this list.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Example Street/ })).toBeVisible();
});

test("comment with evidence, reply, edit, link and delete", async ({ page }) => {
  const u = await trustedUser("commenter");
  await signIn(page, u.email, u.password, "/titles/example-street-2030");
  const section = page.locator("#comments");
  await section.getByLabel("Your comment").fill("The opening titles were made with an image model. Source: https://news.example/street.");
  await section.getByLabel(/Evidence link/).fill("https://News.Example/street-credits");
  await section.getByRole("checkbox", { name: "Visuals" }).check();
  await section.getByRole("button", { name: "Post comment" }).click();

  const comment = section.locator("article").filter({ hasText: "opening titles" });
  await expect(comment).toBeVisible();
  await expect(comment.getByRole("link", { name: "https://news.example/street", exact: true })).toHaveAttribute("rel", /nofollow ugc/);
  await expect(comment.getByRole("link", { name: "https://news.example/street-credits" })).toHaveAttribute("rel", /nofollow ugc/);
  await expect(comment.getByRole("list", { name: "Where AI was used" })).toHaveText("Visuals");

  await comment.getByRole("button", { name: "Reply" }).click();
  await section.getByLabel("Your reply").fill("Thanks, that matches the credits.");
  await section.getByRole("button", { name: "Reply", exact: true }).last().click();
  await expect(section.locator("p", { hasText: "Thanks, that matches the credits." })).toBeVisible();

  await comment.getByRole("button", { name: "Edit" }).first().click();
  const edit = section.getByLabel("Edit your comment");
  await edit.fill("The opening titles were made with an image model.");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(comment.getByText("(edited)")).toBeVisible();

  // The date links to the comment's own anchor.
  const permalink = comment.locator("header a[title='Link to this comment']");
  const href = await permalink.getAttribute("href");
  expect(href).toMatch(/^\/titles\/example-street-2030#comment-[0-9a-f-]{36}$/);
  await page.goto(href!);
  await expect(page.locator(href!.slice(href!.indexOf("#")))).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);

  const reply = section.locator("article").filter({ hasText: "Thanks, that matches" });
  await reply.getByRole("button", { name: "Delete" }).click();
  await reply.getByRole("button", { name: "Yes, delete" }).click();
  await expect(section.getByText("Thanks, that matches the credits.")).toHaveCount(0);
});

test("report a comment, then a moderator hides it from the queue", async ({ browser }) => {
  const writer = await trustedUser("spammer");
  const reporter = await trustedUser("flagger");
  const mod = await trustedUser("moddy", 2, "moderator");
  const body = `Cheap pills at spam.example ${Date.now()}`;

  const w = await (await browser.newContext()).newPage();
  await signIn(w, writer.email, writer.password, "/titles/example-street-2030");
  await w.locator("#comments").getByLabel("Your comment").fill(body);
  await w.locator("#comments").getByRole("button", { name: "Post comment" }).click();
  await expect(w.getByText(body)).toBeVisible();
  await w.context().close();

  const r = await (await browser.newContext()).newPage();
  await signIn(r, reporter.email, reporter.password, "/titles/example-street-2030");
  const comment = r.locator("#comments article").filter({ hasText: body });
  await comment.getByRole("button", { name: "Report" }).click();
  await comment.getByLabel("What is wrong?").selectOption("spam");
  await comment.getByLabel(/Details/).fill("An advert");
  await comment.getByRole("button", { name: "Send report" }).click();
  await expect(comment.getByRole("status")).toHaveText(/A moderator will take a look/);
  await r.context().close();

  // The first visit asks the moderator to set up 2-step login.
  const m = await (await browser.newContext()).newPage();
  await signIn(m, mod.email, mod.password, "/mod");
  await m.waitForURL(/\/settings\/security\?next=%2Fmod/);
  await m.getByRole("button", { name: "Set up 2-step login" }).click();
  const secret = (await m.getByTestId("totp-secret").textContent())!.trim();
  await expect(m.getByRole("img", { name: /QR code/ })).toBeVisible();
  expect((await new AxeBuilder({ page: m }).withTags(WCAG).analyze()).violations).toEqual([]);
  await m.getByLabel("6-digit code").fill(totp(secret) === "111111" ? "222222" : "111111");
  await m.getByRole("button", { name: "Turn on 2-step login" }).click();
  await expect(m.getByText(/That code didn't work/)).toBeVisible();
  await m.getByLabel("6-digit code").fill(totp(secret));
  await m.getByRole("button", { name: "Turn on 2-step login" }).click();
  await m.waitForURL(/\/mod$/);
  await expect(m.getByRole("heading", { name: "Moderator queue" })).toBeVisible();
  const item = m.getByRole("listitem").filter({ hasText: body });
  await expect(item.getByText("Spam: An advert", { exact: false })).toBeVisible();
  expect((await new AxeBuilder({ page: m }).withTags(WCAG).analyze()).violations).toEqual([]);
  await item.getByPlaceholder("Reason for the log (optional)").fill("Advert");
  await item.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(m.getByRole("listitem").filter({ hasText: body })).toHaveCount(0);

  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/titles/example-street-2030");
  await expect(anon.getByText(body)).toHaveCount(0);
  await anon.context().close();
  await m.context().close();
});

test("signed-out visitors are asked to sign in to vote", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("main ul li a").first();
  if ((await first.count()) === 0) test.skip();
  await first.click();
  await expect(page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
  await expect(page.getByText("to vote.")).toBeVisible();
});
