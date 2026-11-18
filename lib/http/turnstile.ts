import type { FetchLike } from "@/lib/catalog/types";

export const TURNSTILE_HEADER = "x-turnstile-token";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Check a Turnstile token with Cloudflare. With no secret configured (local,
 * CI, or before the widget is set up) every request passes, matching the
 * client, which shows no widget without a site key.
 */
export async function verifyTurnstile(
  token: string | null,
  opts: { secret: string | undefined; ip?: string | null; expectedAction?: string; fetchFn?: FetchLike },
): Promise<boolean> {
  if (!opts.secret) return true;
  if (!token || token.length > 2048) return false;
  const form = new URLSearchParams({ secret: opts.secret, response: token });
  if (opts.ip) form.set("remoteip", opts.ip);
  try {
    const res = await (opts.fetchFn ?? fetch)(VERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { success?: boolean; action?: string };
    return body.success === true && (!opts.expectedAction || body.action === opts.expectedAction);
  } catch {
    return false;
  }
}
