"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_EVENT, type ConsentChoice, type ConsentState } from "@/lib/analytics/consent";
import { isPrivatePath, type BrowserEvent, type EventProps } from "@/lib/analytics/events";

type PostHog = typeof import("posthog-js").default;
let client: Promise<PostHog | null> | null = null;

/**
 * Load and start PostHog once, only when a key is configured. It starts
 * cookieless with no replay; applyConsent() turns storage and replay on.
 */
function posthog(key: string | undefined, apiHost: string): Promise<PostHog | null> {
  if (!key) return Promise.resolve(null);
  client ??= import("posthog-js").then(({ default: ph }) => {
    ph.init(key, {
      api_host: "/ingest",
      ui_host: apiHost.replace(".i.posthog.com", ".posthog.com"),
      persistence: "memory",
      disable_session_recording: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: "identified_only",
      // Replays never show text or what people type.
      mask_all_text: true,
      mask_all_element_attributes: true,
      session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    });
    return ph;
  });
  return client;
}

/** Storage and replay follow consent; replay also stays off on private pages. */
function applyConsent(ph: PostHog, consent: ConsentState, pathname: string) {
  if (consent === "granted") {
    ph.set_config({ persistence: "localStorage+cookie" });
    if (isPrivatePath(pathname)) ph.stopSessionRecording();
    else ph.startSessionRecording();
  } else {
    ph.stopSessionRecording();
    ph.set_config({ persistence: "memory" });
  }
}

/** Page views, and the signed-in user's internal id (never email or name). */
export function Analytics({
  posthogKey,
  posthogHost,
  userId,
  consent: initialConsent,
}: {
  posthogKey?: string;
  posthogHost: string;
  userId: string | null;
  consent: ConsentState;
}) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>(initialConsent);

  useEffect(() => {
    const onChange = (e: Event) => {
      const choice = (e as CustomEvent<ConsentChoice>).detail;
      setConsent(choice);
      // A change of mind wipes what PostHog stored under the earlier choice.
      if (choice === "denied") void client?.then((ph) => ph?.reset());
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    void posthog(posthogKey, posthogHost).then((ph) => {
      if (ph) applyConsent(ph, consent, pathname);
    });
  }, [posthogKey, posthogHost, consent, pathname]);

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
