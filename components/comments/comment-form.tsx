"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { Button, inputClass } from "@/components/ui";
import { AI_AREA_LABELS } from "@/lib/services/comments";

type Area = keyof typeof AI_AREA_LABELS;

export interface CommentFormProps {
  mediaId: string;
  /** Reply to this top-level comment. */
  parentId?: string;
  /** Edit this comment instead of posting a new one. */
  edit?: { id: string; body: string; evidenceUrl: string | null; aiAreas: Area[] };
  siteKey?: string;
  needsTurnstile?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}

export function CommentForm({ mediaId, parentId, edit, siteKey, needsTurnstile, onDone, onCancel }: CommentFormProps) {
  const router = useRouter();
  const [body, setBody] = useState(edit?.body ?? "");
  const [evidence, setEvidence] = useState(edit?.evidenceUrl ?? "");
  const [areas, setAreas] = useState<Area[]>(edit?.aiAreas ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const isReply = Boolean(parentId);
  const idBase = edit ? `edit-${edit.id}` : parentId ? `reply-${parentId}` : "new-comment";
  const withTurnstile = Boolean(siteKey && needsTurnstile && !edit);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError("Write something first.");
    if (withTurnstile && !token) return setError("Complete the bot check first.");
    setBusy(true);
    setError(null);
    const payload = isReply ? { body, parentId } : { body, evidenceUrl: evidence.trim() || null, aiAreas: areas };
    const res = await fetch(edit ? `/api/comments/${edit.id}` : `/api/media/${mediaId}/comments`, {
      method: edit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-turnstile-token": token } : {}) },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string; details?: { message?: string }[] };
      } | null;
      setError(data?.error?.details?.[0]?.message ?? data?.error?.message ?? "Could not save your comment. Try again.");
      setReset((n) => n + 1);
      setToken(null);
      return;
    }
    if (!edit) {
      setBody("");
      setEvidence("");
      setAreas([]);
    }
    setReset((n) => n + 1);
    setToken(null);
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="space-y-1">
        <label htmlFor={`${idBase}-body`} className="text-sm font-medium">
          {edit ? "Edit your comment" : isReply ? "Your reply" : "Your comment"}
        </label>
        <textarea
          id={`${idBase}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={isReply ? 2 : 4}
          className={inputClass}
          placeholder={isReply ? "" : "What makes you think it did or didn't use generative AI?"}
        />
        <p className="text-xs text-zinc-600">{body.length} / 2,000. Plain text; links are fine.</p>
      </div>
      {!isReply ? (
        <>
          <div className="space-y-1">
            <label htmlFor={`${idBase}-evidence`} className="text-sm font-medium">
              Evidence link <span className="font-normal text-zinc-600">(optional)</span>
            </label>
            <input
              id={`${idBase}-evidence`}
              type="url"
              inputMode="url"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="https://"
              className={inputClass}
            />
            <p className="text-xs text-zinc-600">Credits, an official statement, an interview or an analysis.</p>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">
              Where was AI used? <span className="font-normal text-zinc-600">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(AI_AREA_LABELS) as Area[]).map((a) => (
                <label key={a} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={areas.includes(a)}
                    onChange={(e) => setAreas((cur) => (e.target.checked ? [...cur, a] : cur.filter((x) => x !== a)))}
                  />
                  {AI_AREA_LABELS[a]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {withTurnstile ? <Turnstile siteKey={siteKey} action="comment" onToken={setToken} resetSignal={reset} /> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : edit ? "Save" : isReply ? "Reply" : "Post comment"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
