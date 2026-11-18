"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isPrivatePath, type BrowserEvent, type EventProps } from "@/lib/analytics/events";

type PostHog = typeof import("posthog-js").default;
let client: Promise<PostHog | null> | null = null;

/** Load and start PostHog once, only when a key is configured. */
function posthog(key: string | undefined, apiHost: string): Promise<PostHog | null> {
  if (!key) return Promise.resolve(null);
  client ??= import("posthog-js").then(({ default: ph }) => {
    ph.init(key, {
      api_host: "/ingest",
      ui_host: apiHost.replace(".i.posthog.com", ".posthog.com"),
      // Cookieless until there is a consent banner; no replay, no autocapture.
      persistence: "memory",
      disable_session_recording: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: "identified_only",
      mask_all_text: true,
      mask_all_element_attributes: true,
    });
    return ph;
  });
  return client;
}

/** Page views, and the signed-in user's internal id (never email or name). */
export function Analytics({ posthogKey, posthogHost, userId }: { posthogKey?: string; posthogHost: string; userId: string | null }) {
  const pathname = usePathname();
  useEffect(() => {
    void posthog(posthogKey, posthogHost).then((ph) => {
      if (!ph) return;
      if (userId) ph.identify(userId);
      ph.capture("$pageview", { $current_url: isPrivatePath(pathname) ? pathname.split("/").slice(0, 2).join("/") : window.location.href });
    });
  }, [posthogKey, posthogHost, userId, pathname]);
  return null;
}

/** Send one browser event when a component mounts, e.g. media_viewed. */
export function TrackEvent({ event, props, posthogKey, posthogHost }: { event: BrowserEvent; props: EventProps; posthogKey?: string; posthogHost: string }) {
  const key = JSON.stringify(props);
  useEffect(() => {
    void posthog(posthogKey, posthogHost).then((ph) => ph?.capture(event, JSON.parse(key) as EventProps));
  }, [event, key, posthogKey, posthogHost]);
  return null;
}

/** Fire-and-forget browser event; does nothing until PostHog has started. */
export function trackBrowser(event: BrowserEvent, props: EventProps = {}): void {
  void client?.then((ph) => ph?.capture(event, props));
}
