import { catalog, CatalogError } from "@/lib/catalog";
import { HttpError } from "@/lib/http/errors";
import { withHandler } from "@/lib/http/handler";
import { pickParams } from "@/lib/http/query";
import { roleAllowed } from "@/lib/services/media";
import { LookupDetailQuery } from "@/lib/validation/media";

/** Full details for one catalogue result, to preview before adding. */
export const GET = withHandler({ auth: "verified", rateLimit: "lookup" }, async ({ request }) => {
  const q = LookupDetailQuery.safeParse(pickParams(request.nextUrl.searchParams, ["source", "id"]));
  if (!q.success) throw new HttpError("unprocessable", "Invalid request.", q.error.issues);
  try {
    const d = await catalog().detail(q.data.source, q.data.id);
    return { ...d, credits: d.credits.filter((c) => roleAllowed(d.kind, c.role)) };
  } catch (err) {
    if (err instanceof CatalogError) throw new HttpError(err.status === 404 ? "not_found" : "internal", err.message);
    throw err;
  }
});
