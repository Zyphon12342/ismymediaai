import { getMediaBySlug } from "@/lib/data/media";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";

/** A title with credits, genres and tally. */
export const GET = withHandler<undefined, { key: string }>({ auth: "public" }, async ({ db, params }) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(params.key) || params.key.length > 120) throw new HttpError("not_found", "Not found.");
  const media = await getMediaBySlug(db, params.key);
  if (!media) throw new HttpError("not_found", "Not found.");
  return media;
});
