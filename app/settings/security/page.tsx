import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MfaSetup, type FactorSummary } from "@/components/auth/mfa-setup";
import { Alert, Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { safeNextPath } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Security", robots: { index: false } };

export default async function SecuritySettingsPage({ searchParams }: PageProps<"/settings/security">) {
  const db = await createClient();
  const me = await getMyProfile(db);
  if (!me) redirect("/sign-in?next=/settings/security");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next, "/") : null;
  const staff = me.role !== "user";

  const { data } = staff ? await db.auth.mfa.listFactors() : { data: null };
  const factors: FactorSummary[] = (data?.totp ?? []).map((f) => ({
    id: f.id,
    name: f.friendly_name || "Authenticator app",
    createdAt: f.created_at,
  }));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <Link href="/settings/profile" className="text-sm underline">
          Edit profile
        </Link>
      </div>
      {sp.mfa === "on" ? <Alert tone="success">2-step login is on.</Alert> : null}
      {sp.mfa === "off" ? <Alert tone="success">That authenticator app was removed.</Alert> : null}
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">2-step login</h2>
          {staff ? (
            <p className="mt-1 text-sm text-zinc-600">
              Moderator tools only work after you enter a code from an authenticator app, so a stolen password alone
              can&apos;t be used to moderate.
              {factors.length === 0 && next ? " Set it up now to open the moderator queue." : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">
              2-step login is required for moderators and admins. It isn&apos;t offered for member accounts yet.
            </p>
          )}
        </div>
        {staff ? <MfaSetup factors={factors} aal={me.aal} next={next} /> : null}
      </Card>
    </div>
  );
}
