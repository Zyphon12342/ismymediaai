import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE } from "@/components/auth/next-cookie";
import { browserOrigin } from "@/lib/http/origin";
import { safeNextPath } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "email_change", "invite", "magiclink"]);

/**
 * Lands every auth round trip:
 * - `?code=` from OAuth sign-in or the default email templates (PKCE)
 * - `?token_hash=&type=` from our email templates, which also work when the
 *   link is opened in a different browser from the one that signed up.
 * Then sends the user to `next` (query, else the cookie), same-site only.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const cookieNext = request.cookies.get(NEXT_COOKIE)?.value;
  const next = safeNextPath(url.searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : null), "/");

  const db = await createClient();
  let failed: string | null = "missing";
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    failed = error ? (error.code ?? "exchange_failed") : null;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = error ? (error.code ?? "verify_failed") : null;
  } else if (url.searchParams.get("error_code")) {
    failed = url.searchParams.get("error_code")!.slice(0, 60);
  }

  const origin = browserOrigin(request.headers, request.url);
  const target = failed
    ? new URL(`/auth/error?reason=${encodeURIComponent(failed)}`, origin)
    : new URL(next, origin);
  const res = NextResponse.redirect(target, 303);
  res.cookies.delete(NEXT_COOKIE);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
