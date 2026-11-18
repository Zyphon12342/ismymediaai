import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cache Components is off: its scheduler relies on Node's setTimeout
  // semantics and hangs on the Workers runtime under OpenNext (checked with
  // wrangler dev, Nov 2026). Revisit when OpenNext supports it.
  poweredByHeader: false,
  // PostHog's endpoints end in "/" and are proxied under /ingest, so Next must
  // not strip the slash there. middleware.ts still redirects /path/ to /path
  // everywhere else.
  skipTrailingSlashRedirect: true,
  images: {
    // Posters come pre-sized from TMDB, Open Library and AniList; no paid resizing.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "s4.anilist.co" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Lets `next dev` read Cloudflare bindings from wrangler.jsonc.
void initOpenNextCloudflareForDev();
