import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Link problem", robots: { index: false } };

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const reason = String((await searchParams).reason ?? "");
  const expired = reason.includes("expired") || reason === "otp_expired";
  return (
    <Card className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">{expired ? "That link has expired" : "That link did not work"}</h1>
      <p className="text-sm text-zinc-700">
        {expired
          ? "Links in our emails work for one hour and only once."
          : "It may have been used already, or opened in a different browser from the one you started in."}{" "}
        If you were verifying your email, it may already be verified: try signing in.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/sign-in" className="font-medium underline">
          Sign in
        </Link>
        <Link href="/forgot-password" className="underline">
          Reset your password
        </Link>
      </div>
    </Card>
  );
}
