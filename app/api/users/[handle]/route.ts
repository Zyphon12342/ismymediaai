import { getProfileStats, getPublicProfile } from "@/lib/data/profiles";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { handle } from "@/lib/validation/common";

/** Public profile card and counts. */
export const GET = withHandler<undefined, { handle: string }>({ auth: "public" }, async ({ db, params }) => {
  const h = handle.safeParse(params.handle);
  if (!h.success) throw new HttpError("not_found", "No such user.");
  const profile = await getPublicProfile(db, h.data);
  if (!profile) throw new HttpError("not_found", "No such user.");
  const stats = await getProfileStats(db, profile.id);
  return { ...profile, stats };
});
