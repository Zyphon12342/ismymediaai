const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reject cross-site mutating requests. A mutating request must carry an
 * Origin header that matches the site, or the request's own host.
 */
export function isSameOrigin(method: string, headers: Headers, siteUrl: string, requestUrl: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).origin;
    return o === new URL(siteUrl).origin || o === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
