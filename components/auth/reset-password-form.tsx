"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { password as passwordSchema } from "@/lib/validation/profile";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const pw = String(form.get("password") ?? "");
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }
    if (pw !== String(form.get("confirm") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.replace("/settings/profile?password=updated");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Field id="password" label="New password" hint="At least 10 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10}
          maxLength={72} className={inputClass} aria-describedby="password-hint" />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
