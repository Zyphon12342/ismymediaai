import type { NextRequest } from "next/server";
import { ingestTarget } from "@/lib/analytics/events";
import { publicEnv } from "@/lib/env";

/**
 * A first-party path for PostHog, so ad blockers drop fewer analytics calls.
 * Forwards only to the configured PostHog host, without the visitor's cookies.
 */
async function proxy(request: NextRequest) {
  const env = publicEnv();
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return new Response(null, { status: 404 });
  // The raw path keeps PostHog's trailing slashes, which route params drop.
  const target = ingestTarget(env.NEXT_PUBLIC_POSTHOG_HOST, request.nextUrl.pathname.slice("/ingest/".length));
  if (!target) return new Response(null, { status: 404 });
  const url = new URL(target);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  for (const h of ["content-type", "content-encoding", "user-agent", "accept"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  const res = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === "POST" ? await request.arrayBuffer() : undefined,
  });
  const out = new Headers();
  for (const h of ["content-type", "content-encoding", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
