"use client";

import { useId, useState } from "react";
import { Button, inputClass } from "@/components/ui";
import { REASONS_FOR, REPORT_REASON_LABELS } from "@/lib/services/moderation";

type Target = keyof typeof REASONS_FOR;

/** A small "Report" link that opens a reason picker inline. */
export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: Target; targetId: string; label?: string }) {
  const id = useId();
  const reasons = REASONS_FOR[targetType];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]!);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, note: note.trim() || null }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setMessage({ ok: true, text: "Thanks. A moderator will take a look." });
      return;
    }
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    setMessage({ ok: false, text: data?.error?.message ?? "Could not send the report. Try again." });
  }

  if (message?.ok) {
    return (
      <p className="text-xs text-zinc-700" role="status">
        {message.text}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline"
      >
        {label}
      </button>
      {open ? (
        <form onSubmit={submit} className="max-w-md space-y-2 rounded-md border border-zinc-200 p-3">
          <label htmlFor={`${id}-reason`} className="block text-xs font-medium">
            What is wrong?
          </label>
          <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={inputClass}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-note`} className="block text-xs font-medium">
            Details <span className="font-normal text-zinc-600">(optional)</span>
          </label>
          <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} className={inputClass} />
          {message && !message.ok ? (
            <p className="text-xs text-red-700" role="alert">
              {message.text}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
