/** The one JSON error shape every API route returns. */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "unprocessable"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  rate_limited: 429,
  internal: 500,
};

export class HttpError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; requestId: string; details?: unknown };
}

/** Map any thrown value to a safe response body. Stack traces never leave the server. */
export function toErrorBody(err: unknown, requestId: string): { status: number; body: ErrorBody } {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          ...(err.details === undefined ? {} : { details: err.details }),
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "internal", message: "Something went wrong.", requestId } },
  };
}

/** Map a Postgres error code (from supabase-js) to an HTTP error. */
export function fromPostgresError(pgCode: string | undefined, message = "Request failed."): HttpError {
  switch (pgCode) {
    case "23505":
      return new HttpError("conflict", "That already exists.");
    case "23514":
    case "22P02":
      return new HttpError("unprocessable", message);
    case "42501":
      return new HttpError("forbidden", "You are not allowed to do that.");
    case "PGRST116":
      return new HttpError("not_found", "Not found.");
    default:
      return new HttpError("internal", "Something went wrong.");
  }
}
