import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { safeNextPath } from "@/lib/services/account";
import { SECURITY_PATH } from "@/lib/services/mfa";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false } };

export default async function MfaChallengePage({ searchParams }: PageProps<"/auth/mfa">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/");
  const db = await createClient();
  const me = await getMyProfile(db);
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(`/auth/mfa?next=${next}`)}`);
  if (me.aal === "aal2") redirect(next);
  const { data } = await db.auth.mfa.listFactors();
  const factor = data?.totp[0];
  if (!factor) redirect(`${SECURITY_PATH}?next=${encodeURIComponent(next)}`);

  return (
    <Card className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="mt-1 text-sm text-zinc-600">Open your authenticator app and enter the 6-digit code for isMyMediaAI.</p>
      </div>
      <MfaChallengeForm factorId={factor.id} next={next} />
      <form action="/auth/sign-out" method="post" className="text-center text-sm text-zinc-600">
        Lost your phone? Ask an admin to reset your 2-step login, or{" "}
        <button type="submit" className="underline">
          sign out
        </button>
        .
      </form>
    </Card>
  );
}
