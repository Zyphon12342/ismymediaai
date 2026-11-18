"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { ACTIONS_FOR, MOD_ACTION_LABELS } from "@/lib/services/moderation";

type Target = keyof typeof ACTIONS_FOR;
type Action = (typeof ACTIONS_FOR)[Target][number];

/** Action buttons for one queue item. Every action asks for an optional reason and is logged. */
export function ModActions({
  targetType,
  targetId,
  commentsLocked,
  actions = ACTIONS_FOR[targetType],
  labels = {},
}: {
  targetType: Target;
  targetId: string;
  commentsLocked?: boolean;
  actions?: Action[];
  labels?: Partial<Record<Action, string>>;
}) {
  const id = useId();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [trust, setTrust] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    const value =
      action === "ban" ? (days === "forever" ? null : Number(days)) : action === "set_trust" ? Number(trust) : action === "lock_comments" ? (commentsLocked ? 0 : 1) : null;
    const res = await fetch("/api/mod/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetType, targetId, reason: reason.trim() || null, value }),
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
      <label htmlFor={`${id}-reason`} className="sr-only">
        Reason for the log
      </label>
      <input
        id={`${id}-reason`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        placeholder="Reason for the log (optional)"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <span key={a} className="inline-flex items-center gap-1">
            {a === "ban" ? (
              <>
                <label htmlFor={`${id}-days`} className="sr-only">
                  Ban length
                </label>
                <select id={`${id}-days`} value={days} onChange={(e) => setDays(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="forever">Indefinitely</option>
                </select>
              </>
            ) : null}
            {a === "set_trust" ? (
              <>
                <label htmlFor={`${id}-trust`} className="sr-only">
                  Trust level
                </label>
                <select id={`${id}-trust`} value={trust} onChange={(e) => setTrust(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="0">0 (new)</option>
                  <option value="1">1 (member)</option>
                  <option value="2">2 (trusted)</option>
                </select>
              </>
            ) : null}
            <Button type="button" variant={a === "dismiss_report" ? "secondary" : "primary"} disabled={busy} onClick={() => run(a)}>
              {a === "lock_comments" && commentsLocked ? "Unlock comments" : (labels[a] ?? MOD_ACTION_LABELS[a])}
            </Button>
          </span>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
