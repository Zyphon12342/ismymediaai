import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/");
  if (await getMyProfile(await createClient())) redirect(next);
  const env = publicEnv();
  return (
    <Card className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">Vote, add evidence and keep track of your history.</p>
      </div>
      <OAuthButtons providers={env.NEXT_PUBLIC_AUTH_PROVIDERS} next={next} />
      <SignInForm siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} next={next} />
    </Card>
  );
}
