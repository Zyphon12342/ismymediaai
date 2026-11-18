import Script from "next/script";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Analytics } from "./analytics";

/** PostHog and Cloudflare Web Analytics, each only when its key is set. */
export async function AnalyticsHooks() {
  const env = publicEnv();
  let userId: string | null = null;
  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    const { data } = await (await createClient()).auth.getClaims();
    userId = typeof data?.claims.sub === "string" ? data.claims.sub : null;
  }
  return (
    <>
      {env.NEXT_PUBLIC_POSTHOG_KEY ? (
        <Analytics posthogKey={env.NEXT_PUBLIC_POSTHOG_KEY} posthogHost={env.NEXT_PUBLIC_POSTHOG_HOST} userId={userId} />
      ) : null}
      {env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: env.NEXT_PUBLIC_CF_BEACON_TOKEN })}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}
