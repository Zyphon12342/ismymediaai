"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { mfaErrorMessage, normalizeTotp } from "@/lib/services/mfa";
import { createClient } from "@/lib/supabase/browser";

/** Ask for the current code from the user's authenticator app. */
export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = normalizeTotp(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!code) {
      setError("Enter the 6-digit code from your app.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId, code });
    if (err) {
      setBusy(false);
      setError(mfaErrorMessage(err));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <Field id="code" label="6-digit code">
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className={inputClass} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
