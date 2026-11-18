"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, inputClass } from "@/components/ui";

/** Close a correction request. Reply to the requester by email first; the note is for the log. */
export function CorrectionActions({ id: requestId }: { id: string }) {
  const id = useId();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "resolved" | "declined") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/mod/corrections/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note.trim() || null }),
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
    <div className="space-y-2">
      <label htmlFor={`${id}-note`} className="sr-only">
        What you did, for the log
      </label>
      <input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What you did, for the log (optional)" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => close("resolved")}>
          Mark resolved
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => close("declined")}>
          Decline
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
