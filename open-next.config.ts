import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Pages are rendered per request (votes change constantly), so the only cache
// needed now is for build-time static pages. Switch to the R2 cache if we
// adopt ISR later; that needs an R2 bucket.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
