"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { MFA_PATH, mfaErrorMessage, normalizeTotp, type Aal } from "@/lib/services/mfa";
import { createClient } from "@/lib/supabase/browser";

export interface FactorSummary {
  id: string;
  name: string;
  createdAt: string;
}

interface Pending {
  factorId: string;
  qr: string;
  secret: string;
}

/** Turn on 2-step login with an authenticator app, or remove one. */
export function MfaSetup({ factors, aal, next }: { factors: FactorSummary[]; aal: Aal; next: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    setBusy(true);
    const db = createClient();
    // Clear any setup that was started and never confirmed, so names don't clash.
    const { data: list } = await db.auth.mfa.listFactors();
    for (const f of list?.all ?? []) {
      if (f.status === "unverified") await db.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: err } = await db.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    });
    setBusy(false);
    if (err || !data) {
      setError(mfaErrorMessage(err));
      return;
    }
    setPending({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    const code = normalizeTotp(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!code) {
      setError("Enter the 6-digit code from your app.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: pending.factorId, code });
    setBusy(false);
    if (err) {
      setError(mfaErrorMessage(err));
      return;
    }
    setPending(null);
    router.replace(next ?? "/settings/security?mfa=on");
    router.refresh();
  }

  async function remove(factorId: string) {
    setError(null);
    setBusy(true);
    const db = createClient();
    const { error: err } = await db.auth.mfa.unenroll({ factorId });
    if (!err) await db.auth.refreshSession();
    setBusy(false);
    if (err) {
      setError(mfaErrorMessage(err));
      return;
    }
    router.replace("/settings/security?mfa=off");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {error ? <Alert>{error}</Alert> : null}

      {factors.length > 0 ? (
        <section className="space-y-3" aria-labelledby="factors-heading">
          <h2 id="factors-heading" className="font-medium">
            Your authenticator apps
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  {f.name}
                  <span className="block text-xs text-zinc-600">Added {new Date(f.createdAt).toLocaleDateString()}</span>
                </span>
                {aal === "aal2" ? (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => remove(f.id)}>
                    Remove
                  </Button>
                ) : (
                  <Link href={`${MFA_PATH}?next=/settings/security`} className="text-sm underline">
                    Enter a code to manage
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending ? (
        <form onSubmit={confirm} noValidate className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>Open an authenticator app, such as Google Authenticator, 1Password or Authy.</li>
            <li>Scan this QR code, or type the setup key below.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URL from Supabase */}
          <img src={pending.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded border border-zinc-200 bg-white p-2" />
          <p className="text-sm">
            Setup key:{" "}
            <code data-testid="totp-secret" className="break-all rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
              {pending.secret}
            </code>
          </p>
          <Field id="code" label="6-digit code">
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Turn on 2-step login"}
          </Button>
        </form>
      ) : (
        <Button type="button" variant={factors.length ? "secondary" : "primary"} disabled={busy} onClick={start}>
          {factors.length ? "Add another authenticator app" : "Set up 2-step login"}
        </Button>
      )}
    </div>
  );
}
