import { z } from "zod";

/**
 * Environment settings, validated once. NEXT_PUBLIC_* values are inlined at
 * build time, so each environment (staging, production) gets its own build.
 * Secrets (SUPABASE_SECRET_KEY, TMDB_API_TOKEN, ...) are Worker secrets and
 * are read only on the server.
 */
export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** CI passes unset repository variables as empty strings. */
function emptyAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === "" ? undefined : v), schema);
}

const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "test", "preview", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Cloudflare Turnstile site key. Unset: no widget (local dev, CI). */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: emptyAsUndefined(z.string().min(1).optional()),
  /** Comma-separated OAuth providers to show on the sign-in page, e.g. "google,github". */
  NEXT_PUBLIC_AUTH_PROVIDERS: emptyAsUndefined(z.string().optional()).transform((v) =>
    (v ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is OAuthProvider => (OAUTH_PROVIDERS as readonly string[]).includes(p)),
  ),
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
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_AUTH_PROVIDERS: process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
  });
  return cached;
}

/** Commit SHA baked in at build time, shown by /api/health. */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
