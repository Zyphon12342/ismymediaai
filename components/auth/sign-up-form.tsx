"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { SignUpInput } from "@/lib/validation/profile";
import { fieldErrors } from "./field-errors";
import { rememberNext } from "./next-cookie";
import { trackBrowser } from "@/components/analytics/analytics";

export function SignUpForm({ siteKey }: { siteKey?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    trackBrowser("signup_started", { method: "email" });
    const form = new FormData(e.currentTarget);
    const parsed = SignUpInput.safeParse({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      handle: String(form.get("handle") ?? ""),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (siteKey && !token) {
      setFormError("Complete the bot check first.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data: free } = await supabase.rpc("handle_available", { p_handle: parsed.data.handle });
    if (free === false) {
      setErrors({ handle: "That username is taken." });
      setBusy(false);
      return;
    }
    rememberNext("/settings/profile?welcome=1");
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { handle: parsed.data.handle },
        ...(token ? { captchaToken: token } : {}),
      },
    });
    setBusy(false);
    if (error) {
      setFormError(authErrorMessage(error));
      setReset((n) => n + 1);
      return;
    }
    // Supabase answers the same way when the email already has an account,
    // so this message never reveals whether an address is registered.
    setSentTo(parsed.data.email);
  }

  if (sentTo) {
    return (
      <Alert tone="success">
        <p className="font-medium">Check your email</p>
        <p className="mt-1">
          We sent a link to <strong>{sentTo}</strong>. Open it to verify your email and finish signing up. The link
          works for one hour.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert>{formError}</Alert> : null}
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass}
          aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
      </Field>
      <Field id="handle" label="Username" hint="3 to 30 letters, numbers or underscores. Shown on your profile." error={errors.handle}>
        <input id="handle" name="handle" type="text" autoComplete="username" required minLength={3} maxLength={30}
          pattern="[A-Za-z0-9_]{3,30}" className={inputClass} aria-invalid={!!errors.handle}
          aria-describedby={errors.handle ? "handle-error" : "handle-hint"} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters." error={errors.password}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10}
          maxLength={72} className={inputClass} aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : "password-hint"} />
      </Field>
      <Turnstile siteKey={siteKey} action="sign-up" onToken={setToken} resetSignal={reset} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
