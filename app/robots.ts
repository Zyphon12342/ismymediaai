import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { robotsRules } from "@/lib/services/seo";

/** Search and answer engines may crawl every public page; staging is never indexed. */
export default function robots(): MetadataRoute.Robots {
  return robotsRules(publicEnv().NEXT_PUBLIC_SITE_URL);
}
