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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The Supabase CLI's fixed local default; only valid against 127.0.0.1.
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

/** A verified account at the given trust level, created directly through the local admin API. */
export async function trustedUser(prefix: string, trustLevel = 1, role: "user" | "moderator" | "admin" = "user") {
  const handle = uniqueHandle(prefix);
  const email = `${handle}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const headers = { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" };
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { handle } }),
  });
  if (!res.ok) throw new Error(`createUser ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ trust_level: trustLevel, role }),
  });
  if (!upd.ok) throw new Error(`trust ${upd.status}`);
  return { id, handle, email, password };
}

/** Delete titles from the fixtures so a test can add them again. */
export async function deleteTitle(source: string, externalId: string) {
  const headers = { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` };
  await fetch(`${SUPABASE_URL}/rest/v1/media?source=eq.${source}&external_id=eq.${encodeURIComponent(externalId)}`, {
    method: "DELETE",
    headers,
  });
}

export async function signIn(page: Page, email: string, password: string, next = "/") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}
