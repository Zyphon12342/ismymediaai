import "server-only";

/**
 * Server-only settings. On Cloudflare these are Worker secrets and vars,
 * which OpenNext exposes on process.env for each request; read them per call.
 */
export function serverEnv() {
  const get = (k: string) => {
    const v = process.env[k];
    return v && v.length > 0 ? v : undefined;
  };
  return {
    TMDB_API_TOKEN: get("TMDB_API_TOKEN"),
    TURNSTILE_SECRET_KEY: get("TURNSTILE_SECRET_KEY"),
    CATALOG_FIXTURES: get("CATALOG_FIXTURES") === "1",
  };
}
