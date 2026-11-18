/**
 * Security headers for every response, including a strict per-request
 * Content-Security-Policy. Scripts run only with this request's nonce
 * ('strict-dynamic' lets those scripts load what they need: Next's chunks,
 * Turnstile, PostHog's recorder and Cloudflare's beacon). Pure function.
 */
export interface CspOptions {
  nonce: string;
  supabaseUrl: string;
  /** `next dev` needs eval for fast refresh; never in a build. */
  dev?: boolean;
  /** Deployed sites upgrade any http:// subresource. */
  deployed?: boolean;
}

export function contentSecurityPolicy({ nonce, supabaseUrl, dev = false, deployed = false }: CspOptions): string {
  const supabase = new URL(supabaseUrl);
  const supabaseWs = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Older browsers without strict-dynamic fall back to these hosts.
      "https://challenges.cloudflare.com",
      "https://static.cloudflareinsights.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // Next, Tailwind and Turnstile set inline styles; styles cannot run code.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      supabase.origin,
      "https://image.tmdb.org",
      "https://covers.openlibrary.org",
      // Open Library covers redirect to the Internet Archive.
      "https://archive.org",
      "https://*.archive.org",
    ],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      supabase.origin,
      supabaseWs,
      "https://challenges.cloudflare.com",
      "https://cloudflareinsights.com",
    ],
    "frame-src": ["https://challenges.cloudflare.com"],
    // PostHog's session recorder compresses in a blob worker.
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (deployed) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** A fresh, unguessable nonce for one response. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function securityHeaders(isProduction: boolean, csp: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (isProduction) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
