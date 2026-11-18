import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * A Supabase client with the secret key: it bypasses Row Level Security.
 * Used for exactly one job, creating a catalogue title the first time someone
 * opens it (see lib/services/catalogue-titles.ts). Everything else uses the
 * caller's own client from ./server.
 */
export function createAdminClient() {
  const key = serverEnv().SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
