/**
 * Where to go after an OAuth or email round trip. Kept in a short-lived
 * cookie rather than the redirect URL, so the Supabase redirect allowlist can
 * stay one exact URL per environment. /auth/callback reads and clears it.
 */
export const NEXT_COOKIE = "imai_next";

export function rememberNext(path: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=900; SameSite=Lax${secure}`;
}
