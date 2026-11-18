import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce, securityHeaders } from "@/lib/http/security-headers";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("content security policy", () => {
  const csp = contentSecurityPolicy({ nonce: "abc123", supabaseUrl: "https://ref.supabase.co", deployed: true });

  it("runs only scripts with this request's nonce, never inline or eval", () => {
    const scripts = directive(csp, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });
  it("allows eval only for next dev", () => {
    const dev = contentSecurityPolicy({ nonce: "n", supabaseUrl: "http://127.0.0.1:54321", dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws://127.0.0.1:54321");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("lets the app reach Supabase, Turnstile and the image hosts, and nothing frames it", () => {
    expect(directive(csp, "connect-src")).toContain("https://ref.supabase.co");
    expect(directive(csp, "connect-src")).toContain("wss://ref.supabase.co");
    expect(directive(csp, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
    expect(directive(csp, "img-src")).toContain("https://image.tmdb.org");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("makes a new random nonce each time", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
  it("sends HSTS only on deployed sites", () => {
    expect(securityHeaders(true, csp)["Strict-Transport-Security"]).toContain("max-age");
    expect(securityHeaders(false, csp)["Strict-Transport-Security"]).toBeUndefined();
  });
});
