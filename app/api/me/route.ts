import { getMyProfile } from "@/lib/data/profiles";
import { HttpError, fromPostgresError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { ownsAvatarPath, profileErrorMessage, toProfileRow } from "@/lib/services/account";
import { ProfileUpdate } from "@/lib/validation/profile";

/** The signed-in user's own profile, including private fields. */
export const GET = withHandler({ auth: "user" }, async ({ db }) => {
  const me = await getMyProfile(db);
  if (!me) throw new HttpError("unauthorized", "Sign in first.");
  return Response.json(me, { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * Edit display name, username, avatar and show_votes. The database enforces
 * the 30-day username rule, reserved names, avatar folders and 10 edits an hour.
 */
export const PATCH = withHandler({ auth: "user", schema: ProfileUpdate }, async ({ db, caller, body }) => {
  const me = caller!;
  if (body.avatarPath && !ownsAvatarPath(me.id, body.avatarPath)) {
    throw new HttpError("forbidden", "That avatar is not yours.");
  }
  const before = body.avatarPath !== undefined ? await getMyProfile(db) : null;

  const { error } = await db.from("profiles").update(toProfileRow(body)).eq("id", me.id);
  if (error) {
    const friendly = profileErrorMessage(error.code, error.message);
    const mapped = fromPostgresError(error.code, friendly ?? "Request failed.");
    throw friendly ? new HttpError(mapped.code, friendly) : mapped;
  }

  // Remove the previous avatar file once the profile no longer points at it.
  const old = before?.avatarPath;
  if (old && old !== body.avatarPath && ownsAvatarPath(me.id, old)) {
    await db.storage.from("avatars").remove([old]);
  }

  const updated = await getMyProfile(db);
  return Response.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});
