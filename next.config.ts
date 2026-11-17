import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cache Components is off: its scheduler relies on Node's setTimeout
  // semantics and hangs on the Workers runtime under OpenNext (checked with
  // wrangler dev, Nov 2026). Revisit when OpenNext supports it.
  poweredByHeader: false,
  images: {
    // Posters come pre-sized from TMDB and Open Library; no paid resizing.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
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
