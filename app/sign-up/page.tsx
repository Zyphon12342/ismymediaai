import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignUpPage() {
  if (await getMyProfile(await createClient())) redirect("/");
  const env = publicEnv();
  return (
    <Card className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-1 text-sm text-zinc-600">
          You need a verified email to vote or comment. Your votes stay private unless you choose to show them.
        </p>
      </div>
      <OAuthButtons providers={env.NEXT_PUBLIC_AUTH_PROVIDERS} next="/settings/profile?welcome=1" />
      <SignUpForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </Card>
  );
}
