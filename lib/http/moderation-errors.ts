import { moderationErrorMessage } from "@/lib/services/moderation";
import { HttpError, fromPostgresError } from "./errors";

/** Map a Postgres error from a report or moderator action to an HTTP error. */
export function moderationError(code: string | undefined, message: string | undefined, rateLimitText: string): HttpError {
  if (code === "RL429") return new HttpError("rate_limited", rateLimitText);
  const friendly = moderationErrorMessage(code, message);
  if (code === "23505") return new HttpError("conflict", friendly!);
  if (code === "P0002") return new HttpError("not_found", friendly!);
  if (code === "42501") return new HttpError("forbidden", friendly!);
  if (code === "22023") return new HttpError("unprocessable", friendly!);
  return fromPostgresError(code);
}
