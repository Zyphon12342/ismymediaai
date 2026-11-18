import { listGenres } from "@/lib/data/media";
import { withHandler } from "@/lib/http/handler";
import { mediaKind } from "@/lib/validation/common";

/** Genres for the filter, limited to the chosen kind. Cached for a day. */
export const GET = withHandler({ auth: "public" }, async ({ db, request }) => {
  const kind = mediaKind.safeParse(request.nextUrl.searchParams.get("kind"));
  const genres = await listGenres(db, kind.success ? kind.data : undefined);
  return Response.json(genres, { headers: { "Cache-Control": "public, max-age=86400" } });
});
