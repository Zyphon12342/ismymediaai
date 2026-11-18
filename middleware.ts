import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { browserOrigin } from "@/lib/http/origin";
import { REQUEST_ID_HEADER, requestIdFrom } from "@/lib/http/request-id";
import { contentSecurityPolicy, newNonce, securityHeaders } from "@/lib/http/security-headers";
import { trimEnd } from "@/lib/services/text";
import { refreshSession } from "@/lib/supabase/middleware";

// Layer 1 of the request checks (see docs/ARCHITECTURE.md). This stays on the
// `middleware` convention with the edge runtime, because OpenNext on
// Cloudflare supports it fully; Next 16's Node.js `proxy` is experimental there.
export async function middleware(request: NextRequest) {
  const env = publicEnv();
  const deployed = env.NEXT_PUBLIC_APP_ENV === "staging" || env.NEXT_PUBLIC_APP_ENV === "production";
  const url = request.nextUrl;

  // Canonical host and scheme: www. and http:// go to the https apex.
  if (deployed) {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL);
    if (url.hostname === `www.${site.hostname}` || url.protocol === "http:") {
      const target = new URL(url.pathname + url.search, site);
      return NextResponse.redirect(target, 308);
    }
  }

  // Analytics proxy: no session work, no trailing-slash rewrite.
  if (url.pathname.startsWith("/ingest/")) return NextResponse.next();

  // One URL per page: /path/ goes to /path (next.config skips Next's own redirect).
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const location = (trimEnd(url.pathname, "/") || "/") + url.search;
    return new NextResponse(null, {
      status: 308,
      headers: { Location: new URL(location, browserOrigin(request.headers, request.url)).toString() },
    });
  }

  const requestId = requestIdFrom(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  // Next reads the nonce from the request's CSP and adds it to its own
  // scripts; components read x-nonce for theirs.
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    dev: process.env.NODE_ENV === "development",
    deployed,
  });
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = await refreshSession(request, () => NextResponse.next({ request: { headers: requestHeaders } }));

  response.headers.set(REQUEST_ID_HEADER, requestId);
  for (const [k, v] of Object.entries(securityHeaders(deployed, csp))) response.headers.set(k, v);
  if (env.NEXT_PUBLIC_APP_ENV !== "production") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico)$).*)",
  ],
};
