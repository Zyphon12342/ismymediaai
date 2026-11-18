"use client";

import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { email as emailSchema } from "@/lib/validation/profile";
import { rememberNext } from "./next-cookie";

export function ForgotPasswordForm({ siteKey }: { siteKey?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(String(new FormData(e.currentTarget).get("email") ?? "").trim());
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }
    if (siteKey && !token) {
      setError("Complete the bot check first.");
      return;
    }
    setBusy(true);
    setError(null);
    rememberNext("/reset-password");
    const { error } = await createClient().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/callback`,
      ...(token ? { captchaToken: token } : {}),
    });
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error));
      setReset((n) => n + 1);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Alert tone="success">
        If an account uses that email, we sent it a link to set a new password. The link works for one hour.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Field id="email" label="Email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Turnstile siteKey={siteKey} action="reset" onToken={setToken} resetSignal={reset} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
