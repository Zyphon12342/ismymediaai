import { commentError } from "@/lib/http/comment-errors";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { toCommentRow } from "@/lib/services/comments";
import { uuid } from "@/lib/validation/common";
import { CommentUpdate } from "@/lib/validation/comment";

function commentId(raw: string): string {
  const id = uuid.safeParse(raw);
  if (!id.success) throw new HttpError("not_found", "Not found.");
  return id.data;
}

/** Edit your own comment within 15 minutes. */
export const PATCH = withHandler<typeof CommentUpdate, { id: string }>(
  { auth: "verified", schema: CommentUpdate },
  async ({ db, params, body, caller }) => {
    const { data, error } = await db
      .from("comments")
      .update(toCommentRow(body))
      .eq("id", commentId(params.id))
      .eq("user_id", caller!.id)
      .is("deleted_at", null)
      .select("id, edited_at")
      .maybeSingle();
    if (error) throw commentError(error.code, error.message);
    if (!data) throw new HttpError("not_found", "Not found.");
    return { id: data.id, editedAt: data.edited_at };
  },
);

/** Soft delete: the author, or a moderator. The text is cleared for good. */
export const DELETE = withHandler<undefined, { id: string }>({ auth: "verified" }, async ({ db, params }) => {
  const { data, error } = await db
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId(params.id))
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw commentError(error.code, error.message);
  if (!data) throw new HttpError("not_found", "Not found.");
  return new Response(null, { status: 204 });
});
