"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, inputClass } from "@/components/ui";

/** Merge a duplicate title into the one that stays. Lives under a disclosure so it is never clicked by accident. */
export function MergeTitle({ fromId, title }: { fromId: string; title: string }) {
  const id = useId();
  const router = useRouter();
  const [into, setInto] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function merge(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mod/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId, into, reason: reason.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? "That did not work. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <details className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Merge this duplicate</summary>
      <form onSubmit={merge} className="mt-3 space-y-2">
        <p className="text-xs text-zinc-600">
          Votes and comments on “{title}” move to the title you keep, and its page redirects there. This cannot be undone from the queue.
        </p>
        <label htmlFor={`${id}-into`} className="block text-xs font-medium">
          Title to keep (link or slug)
        </label>
        <input id={`${id}-into`} value={into} onChange={(e) => setInto(e.target.value)} required maxLength={2000} placeholder="https://ismymediaai.com/titles/…" className={inputClass} />
        <label htmlFor={`${id}-reason`} className="sr-only">
          Reason for the log
        </label>
        <input id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={900} placeholder="Reason for the log (optional)" className={inputClass} />
        <Button type="submit" disabled={busy || !into.trim()}>
          Merge into this title
        </Button>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
