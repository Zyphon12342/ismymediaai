import { BUILD_SHA, publicEnv } from "@/lib/env";
import { withHandler } from "@/lib/http/handler";
import { HttpError } from "@/lib/http/errors";

/**
 * Health check used by the smoke tests and the uptime monitor. Confirms the
 * Worker runs and can read from Supabase through RLS as an anonymous visitor.
 */
export const GET = withHandler({ auth: "public" }, async ({ db }) => {
  const { error } = await db.from("genres").select("id").limit(1);
  if (error) throw new HttpError("internal", "Database unreachable.");
  return Response.json(
    { status: "ok", env: publicEnv().NEXT_PUBLIC_APP_ENV, commit: BUILD_SHA },
    { headers: { "Cache-Control": "no-store" } },
  );
});
