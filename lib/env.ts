import { z } from "zod";

/**
 * Environment settings, validated once. NEXT_PUBLIC_* values are inlined at
 * build time, so each environment (staging, production) gets its own build.
 * Secrets (SUPABASE_SECRET_KEY, TMDB_API_TOKEN, ...) are Worker secrets and
 * are read only on the server.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "test", "preview", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  cached ??= publicSchema.parse({
    // Each key is spelled out so Next.js can inline it at build time.
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}

/** Commit SHA baked in at build time, shown by /api/health. */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
