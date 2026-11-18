import { NextResponse } from "next/server";
import { listComments, myCommentCount } from "@/lib/data/comments";
import { commentError } from "@/lib/http/comment-errors";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { pickParams } from "@/lib/http/query";
import { needsCommentTurnstile, toCommentRow } from "@/lib/services/comments";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";
import { CommentInput, CommentListQuery } from "@/lib/validation/comment";

function mediaId(key: string): string {
  const id = uuid.safeParse(key);
  if (!id.success) throw new HttpError("not_found", "Not found.");
  return id.data;
}

/** Paged comments on a title: evidence first (default) or newest. */
export const GET = withHandler<undefined, { key: string }>({ auth: "public" }, async ({ db, params, request }) => {
  const q = CommentListQuery.safeParse(pickParams(request.nextUrl.searchParams, ["sort", "cursor", "limit"]));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  return listComments(db, mediaId(params.key), q.data);
});

/** Post a comment or a reply. Turnstile is required for a user's first 3 comments. */
export const POST = withHandler<typeof CommentInput, { key: string }>(
  {
    auth: "verified",
    schema: CommentInput,
    turnstile: async () => (needsCommentTurnstile(await myCommentCount(await createClient())) ? "comment" : null),
  },
  async ({ db, params, body }) => {
    const { data, error } = await db
      .from("comments")
      .insert({ media_id: mediaId(params.key), parent_id: body.parentId ?? null, ...toCommentRow(body), body: body.body })
      .select("id, created_at")
      .single();
    if (error) throw commentError(error.code, error.message);
    return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
  },
);
