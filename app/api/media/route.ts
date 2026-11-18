import { catalog, CatalogError } from "@/lib/catalog";
import { browseMedia } from "@/lib/data/media";
import { HttpError, fromPostgresError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { pickParams } from "@/lib/http/query";
import { payloadFromCatalogue, payloadFromManual } from "@/lib/services/media";
import { BrowseQuery, CreateMediaInput } from "@/lib/validation/media";
import { track } from "@/lib/analytics/server";

/** Browse and search published titles. */
export const GET = withHandler({ auth: "public" }, async ({ db, request }) => {
  const q = BrowseQuery.safeParse(pickParams(request.nextUrl.searchParams, ["q", "kind", "genre", "sort", "cursor"]));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  return browseMedia(db, q.data);
});

/**
 * Add a title. Catalogue entries are fetched server-side by id and publish
 * at once; manual entries wait for review. The database enforces trust level
 * 1+, five a day, credit roles and genres.
 */
export const POST = withHandler(
  { auth: "verified", schema: CreateMediaInput, turnstile: "add-title" },
  async ({ db, caller, body }) => {
    if (caller!.trustLevel < 1 && caller!.role === "user") {
      throw new HttpError("forbidden", "New accounts can add titles after 72 hours.");
    }
    let payload;
    if (body.source === "manual") {
      payload = payloadFromManual(body);
    } else {
      try {
        payload = payloadFromCatalogue(await catalog().detail(body.source, body.externalId), body.genres);
      } catch (err) {
        if (err instanceof CatalogError) throw new HttpError(err.status === 404 ? "not_found" : "internal", err.message);
        throw err;
      }
    }
    const { data, error } = await db.rpc("create_media", { p: payload as never }).single();
    if (error) {
      if (error.code === "RL429") throw new HttpError("rate_limited", "You can add 5 titles a day. Try again tomorrow.");
      if (error.code === "23514") throw new HttpError("unprocessable", error.message.includes("genre") ? "Check the genres." : "Some details were not accepted.");
      throw fromPostgresError(error.code);
    }
    const status = data.existing ? 200 : 201;
    if (!data.existing) track("entry_created", caller!.id, { kind: payload.kind, source: payload.source, status: data.status });
    return Response.json({ slug: data.slug, status: data.status, existing: data.existing }, { status });
  },
);
