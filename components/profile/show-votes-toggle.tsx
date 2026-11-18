"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** The owner's "Show my votes" switch on their profile page. */
export function ShowVotesToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const nextValue = !on;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showVotes: nextValue }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not save. Try again.");
      return;
    }
    setOn(nextValue);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="show-votes-label"
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${on ? "bg-zinc-900" : "bg-zinc-300"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      <span id="show-votes-label" className="text-sm text-zinc-800">
        Show my votes
      </span>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}
