import { cookies, headers } from "next/headers";
import Script from "next/script";
import { CONSENT_COOKIE, effectiveConsent } from "@/lib/analytics/consent";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Analytics } from "./analytics";
import { ConsentBanner } from "./consent-banner";

/** The visitor's consent state; "granted" when PostHog is off, as nothing is stored. */
export async function consentState() {
  if (!publicEnv().NEXT_PUBLIC_POSTHOG_KEY) return null;
  const [jar, h] = await Promise.all([cookies(), headers()]);
  return effectiveConsent(jar.get(CONSENT_COOKIE)?.value, h.get("cf-ipcountry"));
}

/** PostHog (behind the consent banner) and Cloudflare Web Analytics, each only when its key is set. */
export async function AnalyticsHooks() {
  const env = publicEnv();
  const consent = await consentState();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  let userId: string | null = null;
  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    const { data } = await (await createClient()).auth.getClaims();
    userId = typeof data?.claims.sub === "string" ? data.claims.sub : null;
  }
  return (
    <>
      {env.NEXT_PUBLIC_POSTHOG_KEY && consent ? (
        <>
          <Analytics posthogKey={env.NEXT_PUBLIC_POSTHOG_KEY} posthogHost={env.NEXT_PUBLIC_POSTHOG_HOST} userId={userId} consent={consent} />
          <ConsentBanner initial={consent} />
        </>
      ) : null}
      {env.NEXT_PUBLIC_CF_BEACON_TOKEN ? (
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: env.NEXT_PUBLIC_CF_BEACON_TOKEN })}
          strategy="afterInteractive"
          nonce={nonce}
        />
      ) : null}
    </>
  );
}
