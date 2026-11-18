/** Analytics event names and helpers shared by server and browser. Pure functions only. */

export type ServerEvent =
  | "signup_completed"
  | "email_verified"
  | "vote_cast"
  | "vote_changed"
  | "vote_removed"
  | "comment_posted"
  | "entry_created"
  | "report_filed";

export type BrowserEvent = "media_viewed" | "signup_started" | "entry_create_started";

export type EventProps = Record<string, string | number | boolean | string[] | null>;

/** Pages where session replay and autocapture must stay off. */
const PRIVATE_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/settings", "/auth", "/mod"];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** PostHog's capture payload. Users are identified by internal id only, never email or name. */
export function captureBody(apiKey: string, event: ServerEvent, distinctId: string, props: EventProps = {}) {
  return {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: { ...props, $lib: "ismymediaai-server" },
    timestamp: new Date().toISOString(),
  };
}

/** Which analytics host serves a proxied /ingest path. */
export function ingestTarget(apiHost: string, path: string): string | null {
  if (!/^[A-Za-z0-9/._-]{1,200}$/.test(path) || path.includes("..") || path.includes("//") || path.startsWith("/")) return null;
  const host = new URL(apiHost);
  if (path.startsWith("static/") || path.startsWith("array/")) {
    host.hostname = host.hostname.replace(/^([a-z]+)\.i\.posthog\.com$/, "$1-assets.i.posthog.com");
  }
  const target = new URL(`${host.origin}/${path}`);
  return target.origin === host.origin ? target.toString() : null;
}
