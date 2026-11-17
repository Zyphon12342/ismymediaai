import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Refresh the Supabase session cookie on every request. Must run before any
 * Server Component reads the session.
 */
export async function refreshSession(request: NextRequest, response: () => NextResponse): Promise<NextResponse> {
  const env = publicEnv();
  let res = response();
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        res = response();
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
      },
    },
  });
  // getClaims() validates the JWT and refreshes it when it has expired.
  await supabase.auth.getClaims();
  return res;
}
