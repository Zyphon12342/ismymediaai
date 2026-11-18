import Link from "next/link";
import { VerifyEmailBanner } from "@/components/auth/resend-verification";
import { Avatar } from "@/components/avatar";
import { HeaderSearch } from "@/components/header-search";
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
    <>
      {/* Sticky so search stays on screen while scrolling. On phones the search box gets its own row. */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <nav
          className="mx-auto grid max-w-5xl grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto]"
          aria-label="Main"
        >
          <Link href="/" className="font-semibold tracking-tight">
            isMyMediaAI
          </Link>
          <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <HeaderSearch />
          </div>
          {me ? (
            <div className="flex items-center gap-3 justify-self-end text-sm">
              {me.role !== "user" ? (
                <Link href="/mod" className="text-zinc-800 hover:underline">
                  Mod queue
                </Link>
              ) : null}
              <Link href={`/u/${me.handle}`} className="flex items-center gap-2 hover:underline">
                <Avatar path={me.avatarPath} handle={me.handle} displayName={me.displayName} size={28} />
                <span className="max-w-[10rem] truncate">@{me.handle}</span>
              </Link>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="text-zinc-700 underline hover:text-zinc-900">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3 justify-self-end text-sm">
              <Link href="/sign-in" className="text-zinc-800 hover:underline">
                Sign in
              </Link>
              <Link href="/sign-up" className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </header>
      {me && !me.emailVerified ? <VerifyEmailBanner email={email} /> : null}
    </>
  );
}
