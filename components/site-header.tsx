import Link from "next/link";
import { VerifyEmailBanner } from "@/components/auth/resend-verification";
import { Avatar } from "@/components/avatar";
import { getMyProfile } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const db = await createClient();
  const me = await getMyProfile(db);
  let email: string | null = null;
  if (me && !me.emailVerified) {
    const { data } = await db.auth.getClaims();
    email = typeof data?.claims.email === "string" ? data.claims.email : null;
  }
  return (
    <header className="border-b border-zinc-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3" aria-label="Main">
        <Link href="/" className="font-semibold tracking-tight">
          isMyMediaAI
        </Link>
        {me ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/u/${me.handle}`} className="flex items-center gap-2 hover:underline">
              <Avatar path={me.avatarPath} handle={me.handle} displayName={me.displayName} size={28} />
              <span>@{me.handle}</span>
            </Link>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="text-zinc-700 underline hover:text-zinc-900">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/sign-in" className="text-zinc-800 hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
              Sign up
            </Link>
          </div>
        )}
      </nav>
      {me && !me.emailVerified ? <VerifyEmailBanner email={email} /> : null}
    </header>
  );
}
