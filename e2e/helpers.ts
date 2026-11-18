import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Wait for the newest email to `to` in the local mail catcher and return its first auth link. */
export async function authLinkFor(to: string, baseURL: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        if (!res.ok) return null;
        const { messages } = (await res.json()) as { messages: { ID: string }[] };
        const id = messages[0]?.ID;
        if (!id) return null;
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
        const href = /href="([^"]*\/auth\/callback[^"]*)"/.exec(msg.HTML)?.[1] ?? null;
        link = href ? href.replace(/&amp;/g, "&") : null;
        return link;
      },
      { timeout: 20_000 },
    )
    .not.toBeNull();
  // Templates use the local Site URL (:3000); send the link to the server under test.
  const url = new URL(link!);
  return new URL(url.pathname + url.search, baseURL).toString();
}

export function uniqueHandle(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function signUp(page: Page, handle: string, password: string) {
  const email = `${handle}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(handle);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  return email;
}
