import { commentErrorMessage } from "@/lib/services/comments";
import { HttpError, fromPostgresError } from "./errors";

/** Map a Postgres error from a comment write to an HTTP error with friendly text. */
export function commentError(code: string | undefined, message: string | undefined): HttpError {
  const friendly = commentErrorMessage(code, message);
  if (code === "RL429") return new HttpError("rate_limited", friendly!);
  if (code === "42501") return new HttpError("forbidden", friendly!);
  if (code === "23503") return new HttpError("not_found", "Not found.");
  if (friendly) return new HttpError("unprocessable", friendly);
  return fromPostgresError(code);
}
