import { expect, type Page } from "@playwright/test";
import { trimEnd } from "../lib/services/text";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** The first /auth/callback URL in a plain-text email body. */
function callbackLink(text: string): string | null {
  for (const word of text.split(/\s/)) {
    const start = word.indexOf("http");
    if (start === -1) continue;
    const candidate = trimEnd(word.slice(start), ")>]");
    try {
      const url = new URL(candidate);
      if (url.pathname === "/auth/callback") return url.toString();
    } catch {
      // not a URL
    }
  }
  return null;
}

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
        if (!id || !/^[A-Za-z0-9]{1,64}$/.test(id)) return null;
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${encodeURIComponent(id)}`)).json()) as { Text: string };
        link = callbackLink(msg.Text);
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
