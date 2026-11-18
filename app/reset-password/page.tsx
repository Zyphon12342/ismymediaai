import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui";
import { getMyProfile } from "@/lib/data/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** Reached from the reset email via /auth/callback, which signs the user in first. */
export default async function ResetPasswordPage() {
  if (!(await getMyProfile(await createClient()))) redirect("/forgot-password");
  return (
    <Card className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
      <ResetPasswordForm />
    </Card>
  );
}
