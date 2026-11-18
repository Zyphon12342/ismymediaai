import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <Card className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-zinc-600">We will email you a link to set a new one.</p>
      </div>
      <ForgotPasswordForm siteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </Card>
  );
}
