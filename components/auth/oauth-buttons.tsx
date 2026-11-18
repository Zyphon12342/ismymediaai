"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { OAuthProvider } from "@/lib/env";
import { authErrorMessage } from "@/lib/services/account";
import { createClient } from "@/lib/supabase/browser";
import { rememberNext } from "./next-cookie";
import { ProviderIcon } from "./provider-icons";

const LABELS: Record<OAuthProvider, string> = { google: "Continue with Google", github: "Continue with GitHub" };

export function OAuthButtons({ providers, next }: { providers: OAuthProvider[]; next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  if (providers.length === 0) return null;

  async function go(provider: OAuthProvider) {
    setBusy(provider);
    setError(null);
    rememberNext(next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(authErrorMessage(error));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Button key={p} type="button" variant="secondary" className="w-full" disabled={busy !== null} onClick={() => go(p)}>
          <ProviderIcon provider={p} />
          <span>{busy === p ? "Redirecting…" : LABELS[p]}</span>
        </Button>
      ))}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex items-center gap-3 py-2 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200" />
        or with email
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}
