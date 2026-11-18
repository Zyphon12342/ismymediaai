import { NextResponse } from "next/server";
import { withHandler } from "@/lib/http/handler";
import { HttpError } from "@/lib/http/errors";
import { moderationError } from "@/lib/http/moderation-errors";
import { slugFromTitleRef } from "@/lib/services/moderation";
import { MergeInput } from "@/lib/validation/moderation";

/** Merge a duplicate title into the one that stays. Votes and comments move; the duplicate redirects. */
export const POST = withHandler<typeof MergeInput>({ auth: "moderator", schema: MergeInput }, async ({ db, body }) => {
  const slug = slugFromTitleRef(body.into);
  if (!slug) throw new HttpError("unprocessable", "Paste the link or slug of the title to keep.");
  const { data: keep, error: findError } = await db.from("media").select("id").eq("slug", slug).maybeSingle();
  if (findError) throw moderationError(findError.code, findError.message, "Too many actions. Wait a minute.");
  if (!keep) throw new HttpError("not_found", "No title has that link.");
  const { data, error } = await db.rpc("merge_media", {
    p_from: body.fromId,
    p_into: keep.id,
    p_reason: body.reason ?? undefined,
  });
  if (error) throw moderationError(error.code, error.message, "Too many actions. Wait a minute.");
  return NextResponse.json({ logId: data, into: slug }, { status: 201 });
});
