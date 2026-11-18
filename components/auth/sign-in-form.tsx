"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { SignInInput } from "@/lib/validation/profile";
import { fieldErrors } from "./field-errors";

export function SignInForm({ siteKey, next }: { siteKey?: string; next: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const parsed = SignInInput.safeParse({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
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
    const { error } = await createClient().auth.signInWithPassword({
      ...parsed.data,
      ...(token ? { options: { captchaToken: token } } : {}),
    });
    if (error) {
      setBusy(false);
      setFormError(authErrorMessage(error));
      setReset((n) => n + 1);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert>{formError}</Alert> : null}
      <Field id="email" label="Email" error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass}
          aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={72}
          className={inputClass} aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined} />
      </Field>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-zinc-700 underline">
          Forgot your password?
        </Link>
      </div>
      <Turnstile siteKey={siteKey} action="sign-in" onToken={setToken} resetSignal={reset} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-zinc-600">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-zinc-900 underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
