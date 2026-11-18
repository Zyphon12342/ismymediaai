const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Reject cross-site mutating requests. A mutating request must carry an
 * Origin header that matches the site, the request URL, or the Host header
 * (local workerd rewrites the request URL's host to localhost). A cross-site
 * page cannot make the browser send a Host other than ours, so this stays safe.
 */
export function isSameOrigin(method: string, headers: Headers, siteUrl: string, requestUrl: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).origin;
    if (o === new URL(siteUrl).origin || o === new URL(requestUrl).origin) return true;
    const host = headers.get("host");
    return !!host && o === `${new URL(requestUrl).protocol}//${host}`;
  } catch {
    return false;
  }
}

/**
 * The origin the browser used, from the Host header. Local workerd rewrites
 * the request URL's host to localhost, which would move cookies set for
 * 127.0.0.1 out of reach after a redirect.
 */
export function browserOrigin(headers: Headers, requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = headers.get("host");
  return host && /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) ? `${url.protocol}//${host}` : url.origin;
}
