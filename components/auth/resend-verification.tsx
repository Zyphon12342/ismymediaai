"use client";

import { useState } from "react";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { rememberNext } from "./next-cookie";

/** Banner for signed-in users whose email is not verified yet. */
export function VerifyEmailBanner({ email }: { email: string | null }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | string>("idle");

  async function resend() {
    if (!email) return;
    setState("sending");
    rememberNext("/settings/profile?verified=1");
    const { error } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setState(error ? authErrorMessage(error) : "sent");
  }

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <span>Verify your email to vote, comment and add titles.</span>
        {email ? (
          state === "sent" ? (
            <span className="font-medium">Sent. Check your inbox.</span>
          ) : (
            <button type="button" onClick={resend} disabled={state === "sending"} className="font-medium underline">
              {state === "sending" ? "Sending…" : "Resend the link"}
            </button>
          )
        ) : null}
        {state !== "idle" && state !== "sending" && state !== "sent" ? <span>{state}</span> : null}
      </div>
    </div>
  );
}
