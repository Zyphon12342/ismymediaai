import { getPublicProfile, listProfileComments } from "@/lib/data/profiles";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { handle, pageQuery } from "@/lib/validation/common";

/** Comment history, newest first, visible comments only. */
export const GET = withHandler<undefined, { handle: string }>({ auth: "public" }, async ({ db, params, request }) => {
  const h = handle.safeParse(params.handle);
  const q = pageQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  const profile = h.success ? await getPublicProfile(db, h.data) : null;
  if (!profile) throw new HttpError("not_found", "No such user.");
  return listProfileComments(db, profile.id, q.data);
});
