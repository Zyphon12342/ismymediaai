import { HttpError, fromPostgresError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { uuid } from "@/lib/validation/common";
import { VoteInput } from "@/lib/validation/vote";

function mediaId(key: string): string {
  const id = uuid.safeParse(key);
  if (!id.success) throw new HttpError("not_found", "Not found.");
  return id.data;
}

function voteError(code: string | undefined): HttpError {
  if (code === "RL429") return new HttpError("rate_limited", "Too many vote changes. Wait a minute.");
  if (code === "42501") return new HttpError("forbidden", "You can't vote on this title.");
  if (code === "23503") return new HttpError("not_found", "Not found.");
  return fromPostgresError(code);
}

/** Set or change your vote. Counted in the tally once your account is trust level 1. */
export const PUT = withHandler<typeof VoteInput, { key: string }>(
  { auth: "verified", schema: VoteInput },
  async ({ db, params, body, caller }) => {
    const { error } = await db.rpc("cast_vote", { p_media: mediaId(params.key), p_value: body.value });
    if (error) throw voteError(error.code);
    return { value: body.value, counted: caller!.trustLevel >= 1 };
  },
);

/** Withdraw your vote. */
export const DELETE = withHandler<undefined, { key: string }>({ auth: "verified" }, async ({ db, params, caller }) => {
  const { error } = await db.from("votes").delete().eq("media_id", mediaId(params.key)).eq("user_id", caller!.id);
  if (error) throw voteError(error.code);
  return new Response(null, { status: 204 });
});
