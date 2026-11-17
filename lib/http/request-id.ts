export const REQUEST_ID_HEADER = "x-request-id";

const VALID = /^[A-Za-z0-9-]{8,64}$/;

/** Reuse a sane incoming request id (e.g. from Cloudflare), else make one. */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER) ?? headers.get("cf-ray");
  return incoming && VALID.test(incoming) ? incoming : crypto.randomUUID();
}
