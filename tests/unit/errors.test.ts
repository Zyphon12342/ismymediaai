import { describe, expect, it } from "vitest";
import { HttpError, fromPostgresError, toErrorBody } from "@/lib/http/errors";
import { browserOrigin, isSameOrigin } from "@/lib/http/origin";
import { requestIdFrom } from "@/lib/http/request-id";

describe("error mapping", () => {
  it("keeps HttpError codes and adds the request id", () => {
    expect(toErrorBody(new HttpError("not_found", "Nope"), "req-12345678")).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: "Nope", requestId: "req-12345678" } },
    });
  });

  it("never leaks internal error messages", () => {
    const { status, body } = toErrorBody(new Error("password=hunter2 at db.ts:12"), "req-12345678");
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });

  it("maps Postgres codes", () => {
    expect(fromPostgresError("23505").status).toBe(409);
    expect(fromPostgresError("42501").status).toBe(403);
    expect(fromPostgresError("23514").status).toBe(422);
    expect(fromPostgresError("PGRST116").status).toBe(404);
    expect(fromPostgresError("RL429").status).toBe(429);
    expect(fromPostgresError("XX000").status).toBe(500);
  });
});

describe("origin check", () => {
  const site = "https://ismymediaai.com";
  const h = (origin?: string) => new Headers(origin ? { origin } : {});

  it("allows safe methods without an Origin", () => {
    expect(isSameOrigin("GET", h(), site, `${site}/api/x`)).toBe(true);
  });

  it("allows same-origin writes and blocks cross-site or missing Origin", () => {
    expect(isSameOrigin("POST", h(site), site, `${site}/api/x`)).toBe(true);
    expect(isSameOrigin("POST", h("https://evil.example"), site, `${site}/api/x`)).toBe(false);
    expect(isSameOrigin("PUT", h(), site, `${site}/api/x`)).toBe(false);
    expect(isSameOrigin("DELETE", h("null"), site, `${site}/api/x`)).toBe(false);
  });

  it("accepts an Origin that matches the Host header (local workerd)", () => {
    const headers = new Headers({ origin: "http://127.0.0.1:8787", host: "127.0.0.1:8787" });
    expect(isSameOrigin("PATCH", headers, "http://localhost:3000", "http://localhost:8787/api/me")).toBe(true);
    const evil = new Headers({ origin: "http://evil.example", host: "127.0.0.1:8787" });
    expect(isSameOrigin("PATCH", evil, "http://localhost:3000", "http://localhost:8787/api/me")).toBe(false);
  });
});

describe("browserOrigin", () => {
  it("prefers a sane Host header", () => {
    expect(browserOrigin(new Headers({ host: "127.0.0.1:8787" }), "http://localhost:8787/x")).toBe("http://127.0.0.1:8787");
    expect(browserOrigin(new Headers({ host: "evil/path" }), "https://ismymediaai.com/x")).toBe("https://ismymediaai.com");
    expect(browserOrigin(new Headers(), "https://ismymediaai.com/x")).toBe("https://ismymediaai.com");
  });
});

describe("request ids", () => {
  it("reuses a valid incoming id and replaces junk", () => {
    expect(requestIdFrom(new Headers({ "x-request-id": "abcdef12-3456" }))).toBe("abcdef12-3456");
    expect(requestIdFrom(new Headers({ "x-request-id": "<script>" }))).not.toBe("<script>");
  });
});
