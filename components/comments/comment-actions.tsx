"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CommentForm, type CommentFormProps } from "./comment-form";

/** Reply, edit and delete controls under one comment. */
export function CommentActions({
  mediaId,
  comment,
  canReply,
  canEdit,
  canDelete,
  siteKey,
  needsTurnstile,
}: {
  mediaId: string;
  comment: NonNullable<CommentFormProps["edit"]> & { isReply: boolean };
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  siteKey?: string;
  needsTurnstile?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "reply" | "edit" | "confirm-delete">("none");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(data?.error?.message ?? "Could not delete it. Try again.");
      return;
    }
    setMode("none");
    router.refresh();
  }

  const link = "text-xs font-medium text-zinc-700 underline-offset-2 hover:underline";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {canReply && !comment.isReply ? (
          <button type="button" className={link} onClick={() => setMode(mode === "reply" ? "none" : "reply")}>
            Reply
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" className={link} onClick={() => setMode(mode === "edit" ? "none" : "edit")}>
            Edit
          </button>
        ) : null}
        {canDelete ? (
          mode === "confirm-delete" ? (
            <span className="inline-flex gap-2 text-xs">
              Delete for good?
              <button type="button" className={`${link} text-red-700`} onClick={remove}>
                Yes, delete
              </button>
              <button type="button" className={link} onClick={() => setMode("none")}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className={link} onClick={() => setMode("confirm-delete")}>
              Delete
            </button>
          )
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {mode === "reply" ? (
        <CommentForm
          mediaId={mediaId}
          parentId={comment.id}
          siteKey={siteKey}
          needsTurnstile={needsTurnstile}
          onDone={() => setMode("none")}
          onCancel={() => setMode("none")}
        />
      ) : null}
      {mode === "edit" ? (
        <CommentForm mediaId={mediaId} edit={comment} onDone={() => setMode("none")} onCancel={() => setMode("none")} />
      ) : null}
    </div>
  );
}
