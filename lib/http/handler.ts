import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createClient, type DbClient } from "@/lib/supabase/server";
import { HttpError, toErrorBody } from "./errors";
import { serverEnv } from "@/lib/env.server";
import { isSameOrigin } from "./origin";
import { TURNSTILE_HEADER, verifyTurnstile } from "./turnstile";
import { REQUEST_ID_HEADER, requestIdFrom } from "./request-id";
import { MFA_REQUIRED_MESSAGE, aalFrom, needsStepUp, type Aal } from "@/lib/services/mfa";

/**
 * Who may call a route:
 * - public: anyone
 * - user: signed in
 * - verified: signed in with a confirmed email and not banned
 * - moderator: verified moderator or admin whose session passed 2-step login
 */
export type AuthLevel = "public" | "user" | "verified" | "moderator";

export interface Caller {
  id: string;
  role: "user" | "moderator" | "admin";
  trustLevel: number;
  emailVerified: boolean;
  bannedUntil: string | null;
  /** aal2 once the session passed 2-step login (TOTP). */
  aal: Aal;
}

export interface HandlerPolicy<S extends z.ZodType | undefined> {
  auth: AuthLevel;
  /** Validates the JSON body of mutating requests. Unknown fields must be rejected by the schema (z.strictObject). */
  schema?: S;
  /**
   * Require a Turnstile token in the x-turnstile-token header, checked
   * against this action name. A function decides per caller (e.g. only for
   * someone's first few comments).
   */
  turnstile?: string | ((caller: Caller | null) => string | null | Promise<string | null>);
  /** A fixed per-user limit from public.rate_limit_check(). Writes are also limited by database triggers. */
  rateLimit?: "lookup";
}

export interface HandlerContext<S extends z.ZodType | undefined, P> {
  request: NextRequest;
  requestId: string;
  db: DbClient;
  caller: Caller | null;
  body: S extends z.ZodType ? z.infer<S> : undefined;
  params: P;
}

type RouteContext<P> = { params: Promise<P> };

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wrap a route handler with the shared checks, in order: origin check on
 * mutating requests, auth level, body validation, then the handler. Errors
 * become `{ error: { code, message, requestId } }`.
 */
export function withHandler<S extends z.ZodType | undefined = undefined, P = Record<string, string>>(
  policy: HandlerPolicy<S>,
  handler: (ctx: HandlerContext<S, P>) => Promise<Response | unknown>,
) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    const requestId = requestIdFrom(request.headers);
    try {
      if (!isSameOrigin(request.method, request.headers, publicEnv().NEXT_PUBLIC_SITE_URL, request.url)) {
        throw new HttpError("forbidden", "Cross-site request blocked.");
      }

      const db = await createClient();
      const caller = policy.auth === "public" ? await optionalCaller(db) : await requireCaller(db, policy.auth);

      if (policy.rateLimit && caller) {
        const { error } = await db.rpc("rate_limit_check", { p_bucket: policy.rateLimit });
        if (error) throw error.code === "RL429" ? new HttpError("rate_limited", "Too many requests. Try again later.") : error;
      }

      if (policy.turnstile) {
        const action = typeof policy.turnstile === "string" ? policy.turnstile : await policy.turnstile(caller);
        if (action) {
          const ok = await verifyTurnstile(request.headers.get(TURNSTILE_HEADER), {
            secret: serverEnv().TURNSTILE_SECRET_KEY,
            ip: request.headers.get("cf-connecting-ip"),
            expectedAction: action,
          });
          if (!ok) throw new HttpError("forbidden", "The bot check failed. Try it again.", { turnstile: true });
        }
      }

      let body: unknown = undefined;
      if (policy.schema && MUTATING.has(request.method)) {
        const json: unknown = await request.json().catch(() => {
          throw new HttpError("bad_request", "Body must be JSON.");
        });
        const parsed = policy.schema.safeParse(json);
        if (!parsed.success) {
          throw new HttpError("unprocessable", "Invalid request.", parsed.error.issues);
        }
        body = parsed.data;
      }

      const params = (await context.params) ?? ({} as P);
      const result = await handler({
        request,
        requestId,
        db,
        caller,
        body: body as HandlerContext<S, P>["body"],
        params,
      });
      const response = result instanceof Response ? result : NextResponse.json(result ?? null);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } catch (err) {
      if (!(err instanceof HttpError)) {
        console.error(JSON.stringify({ level: "error", requestId, message: String(err) }));
      }
      const { status, body } = toErrorBody(err, requestId);
      return NextResponse.json(body, { status, headers: { [REQUEST_ID_HEADER]: requestId } });
    }
  };
}

async function loadCaller(db: DbClient): Promise<Caller | null> {
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) return null;
  const { data, error } = await db.rpc("my_profile").maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    role: data.role,
    trustLevel: data.trust_level,
    emailVerified: data.email_verified,
    bannedUntil: data.banned_until,
    aal: aalFrom(claims.claims),
  };
}

async function optionalCaller(db: DbClient): Promise<Caller | null> {
  return loadCaller(db);
}

async function requireCaller(db: DbClient, level: Exclude<AuthLevel, "public">): Promise<Caller> {
  const caller = await loadCaller(db);
  if (!caller) throw new HttpError("unauthorized", "Sign in first.");
  if (level === "user") return caller;
  if (caller.bannedUntil && new Date(caller.bannedUntil) > new Date()) {
    throw new HttpError("forbidden", "This account is suspended.");
  }
  if (!caller.emailVerified) throw new HttpError("forbidden", "Verify your email first.");
  if (level === "moderator" && caller.role === "user") {
    throw new HttpError("forbidden", "Moderators only.");
  }
  if (level === "moderator" && needsStepUp(caller.role, caller.aal)) {
    throw new HttpError("forbidden", MFA_REQUIRED_MESSAGE, { mfa: true });
  }
  return caller;
}
