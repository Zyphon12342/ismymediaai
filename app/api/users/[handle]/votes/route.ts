import { canSeeVotes, getPublicProfile, listProfileVotes } from "@/lib/data/profiles";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { handle, pageQuery } from "@/lib/validation/common";

/**
 * Vote history. Private votes answer 404 to everyone but their owner, and Row
 * Level Security returns no rows to others even if this check were skipped.
 */
export const GET = withHandler<undefined, { handle: string }>(
  { auth: "public" },
  async ({ db, params, request, caller }) => {
    const h = handle.safeParse(params.handle);
    const q = pageQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
    const profile = h.success ? await getPublicProfile(db, h.data) : null;
    if (!profile || !canSeeVotes(profile, caller?.id ?? null)) throw new HttpError("not_found", "No such user.");
    const page = await listProfileVotes(db, profile.id, q.data);
    return Response.json(page, { headers: { "Cache-Control": "private, no-store" } });
  },
);
