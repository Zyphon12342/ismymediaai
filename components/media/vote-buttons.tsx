"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VOTE_LABELS } from "@/lib/services/labels";

type Value = keyof typeof VOTE_LABELS;

const STYLES: Record<Value, { on: string; off: string }> = {
  uses_ai: { on: "border-vote-ai bg-vote-ai text-white", off: "border-vote-ai text-orange-800 hover:bg-orange-50" },
  unsure: { on: "border-zinc-500 bg-zinc-600 text-white", off: "border-zinc-400 text-zinc-800 hover:bg-zinc-50" },
  no_ai: { on: "border-vote-no-ai bg-vote-no-ai text-white", off: "border-vote-no-ai text-blue-800 hover:bg-blue-50" },
};

export function VoteButtons({
  mediaId,
  slug,
  initial,
  state,
}: {
  mediaId: string;
  slug: string;
  initial: Value | null;
  /** signed_out | unverified | new (trust 0: vote saved, not yet counted) | ok */
  state: "signed_out" | "unverified" | "new" | "ok";
}) {
  const router = useRouter();
  const [vote, setVote] = useState<Value | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "signed_out") {
    return (
      <p className="text-sm text-zinc-700">
        <Link href={`/sign-in?next=/titles/${slug}`} className="font-medium underline">
          Sign in
        </Link>{" "}
        to vote. Your vote stays private unless you choose to show it.
      </p>
    );
  }
  if (state === "unverified") {
    return <p className="text-sm text-zinc-700">Verify your email to vote. Check your inbox for the link.</p>;
  }

  async function choose(value: Value) {
    const withdraw = vote === value;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/media/${mediaId}/vote`, {
      method: withdraw ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      ...(withdraw ? {} : { body: JSON.stringify({ value }) }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not save your vote. Try again.");
      return;
    }
    setVote(withdraw ? null : value);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Your vote" className="flex flex-wrap gap-2">
        {(["uses_ai", "unsure", "no_ai"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vote === v}
            disabled={busy}
            onClick={() => choose(v)}
            className={`rounded-md border-2 px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60 ${vote === v ? STYLES[v].on : STYLES[v].off}`}
          >
            {VOTE_LABELS[v]}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-600" aria-live="polite">
        {error ??
          (vote
            ? state === "new"
              ? "Vote saved. It starts counting in the totals once your account is 72 hours old."
              : "Vote saved. Click it again to withdraw it."
            : "Pick one. You can change your vote at any time.")}
      </p>
    </div>
  );
}
