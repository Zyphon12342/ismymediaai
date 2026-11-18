import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { titlePath } from "@/lib/services/labels";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

/** The home page and every published title. One file holds up to 50,000 URLs. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const { data, error } = await createPublicClient().rpc("sitemap_media", { p_offset: 0, p_limit: 49_000 });
  if (error) throw error;
  return [
    { url: new URL("/", site).toString(), changeFrequency: "daily", priority: 1 },
    { url: new URL("/corrections", site).toString(), changeFrequency: "yearly", priority: 0.2 },
    ...(data ?? []).map((m) => ({
      url: new URL(titlePath(m.slug), site).toString(),
      lastModified: new Date(m.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
