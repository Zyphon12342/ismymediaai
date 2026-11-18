import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { ShowVotesToggle } from "@/components/profile/show-votes-toggle";
import { Alert, Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { publicEnv } from "@/lib/env";
import { handleChangeStatus } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/server";
import { PLACEHOLDER_HANDLE } from "@/lib/validation/profile";

export const metadata: Metadata = { title: "Edit profile", robots: { index: false } };

export default async function ProfileSettingsPage({ searchParams }: PageProps<"/settings/profile">) {
  const db = await createClient();
  const me = await getMyProfile(db);
  if (!me) redirect("/sign-in?next=/settings/profile");
  const sp = await searchParams;
  const { data: claims } = await db.auth.getClaims();
  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;
  const status = handleChangeStatus(me.handleChangedAt ? new Date(me.handleChangedAt) : null);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit profile</h1>
        <Link href={`/u/${me.handle}`} className="text-sm underline">
          View profile
        </Link>
      </div>
      {sp.welcome ? (
        <Alert tone="success">Your email is verified and you are signed in. Welcome to isMyMediaAI.</Alert>
      ) : null}
      {sp.password === "updated" ? <Alert tone="success">Your password was changed.</Alert> : null}
      <Card>
        <ProfileSettingsForm
          userId={me.id}
          supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL}
          handle={me.handle}
          displayName={me.displayName}
          avatarPath={me.avatarPath}
          showVotes={me.showVotes}
          handleLockedUntil={status.allowed ? null : status.nextAt.toISOString()}
          placeholderHandle={PLACEHOLDER_HANDLE.test(me.handle)}
        />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Privacy</h2>
        <p className="text-sm text-zinc-700">
          Your individual votes are private unless you turn this on. Totals never show who voted.
        </p>
        <ShowVotesToggle initial={me.showVotes} />
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Account</h2>
        <p className="text-zinc-700">
          Email: {email ?? "unknown"} {me.emailVerified ? "(verified)" : "(not verified yet)"}
        </p>
        <Link href="/reset-password" className="inline-block underline">
          Change password
        </Link>
      </Card>
    </div>
  );
}
