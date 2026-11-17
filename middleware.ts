import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { REQUEST_ID_HEADER, requestIdFrom } from "@/lib/http/request-id";
import { securityHeaders } from "@/lib/http/security-headers";
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

  const requestId = requestIdFrom(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = await refreshSession(request, () => NextResponse.next({ request: { headers: requestHeaders } }));

  response.headers.set(REQUEST_ID_HEADER, requestId);
  for (const [k, v] of Object.entries(securityHeaders(deployed))) response.headers.set(k, v);
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
