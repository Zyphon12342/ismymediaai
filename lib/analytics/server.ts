import "server-only";
import { after } from "next/server";
import { publicEnv } from "@/lib/env";
import { captureBody, type EventProps, type ServerEvent } from "./events";

/**
 * Send one event to PostHog after the response is sent, so analytics never
 * slows down or breaks a request. Does nothing without a PostHog key, and
 * never in local development or tests.
 */
export function track(event: ServerEvent, distinctId: string, props: EventProps = {}): void {
  const env = publicEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY || env.NEXT_PUBLIC_APP_ENV === "local" || env.NEXT_PUBLIC_APP_ENV === "test") return;
  const body = JSON.stringify(captureBody(env.NEXT_PUBLIC_POSTHOG_KEY, event, distinctId, props));
  const url = new URL("/i/v0/e/", env.NEXT_PUBLIC_POSTHOG_HOST).toString();
  after(async () => {
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    } catch {
      // Analytics is best effort.
    }
  });
}
