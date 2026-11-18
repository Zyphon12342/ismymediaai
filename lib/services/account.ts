/** Account and profile rules shared by pages, routes and tests. Pure functions only. */
import type { ProfileUpdate } from "@/lib/validation/profile";
import { trimEnd } from "./text";

export const HANDLE_CHANGE_DAYS = 30;
const DAY_MS = 86_400_000;

/** Whether the username can change now, and if not, when it can. */
export function handleChangeStatus(
  handleChangedAt: Date | null,
  now = new Date(),
): { allowed: true } | { allowed: false; nextAt: Date } {
  if (!handleChangedAt) return { allowed: true };
  const nextAt = new Date(handleChangedAt.getTime() + HANDLE_CHANGE_DAYS * DAY_MS);
  return nextAt <= now ? { allowed: true } : { allowed: false, nextAt };
}

/**
 * A same-site path to send someone to after signing in. Anything that could
 * leave the site (absolute URLs, protocol-relative //host, backslashes) falls
 * back, so the ?next= parameter cannot be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;
    // Never bounce back into the auth pages themselves.
    if (/^\/(sign-in|sign-up|auth\/)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Public URL of an avatar in the public `avatars` bucket. */
export function avatarUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${trimEnd(supabaseUrl, "/")}/storage/v1/object/public/avatars/${encoded}`;
}

/** One or two letters for the avatar placeholder. */
export function initials(displayName: string | null | undefined, handle: string): string {
  const source = (displayName ?? "").trim() || handle;
  const words = source.split(/[\s_]+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0]![0]! + words[1]![0]! : source.slice(0, 2);
  return letters.toUpperCase();
}

export function memberSince(createdAt: Date): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(createdAt);
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Map a validated PATCH /api/me body to profile columns. */
export function toProfileRow(input: ProfileUpdate): {
  handle?: string;
  display_name?: string | null;
  avatar_path?: string | null;
  show_votes?: boolean;
} {
  const row: ReturnType<typeof toProfileRow> = {};
  if (input.handle !== undefined) row.handle = input.handle;
  if (input.displayName !== undefined) row.display_name = input.displayName;
  if (input.avatarPath !== undefined) row.avatar_path = input.avatarPath;
  if (input.showVotes !== undefined) row.show_votes = input.showVotes;
  return row;
}

/** Whether an avatar path belongs to this user. The database checks it too. */
export function ownsAvatarPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.slice(userId.length + 1).includes("/");
}

/** Friendly text for database rule violations raised by profile updates. */
export function profileErrorMessage(pgCode: string | undefined, pgMessage: string | undefined): string | null {
  if (pgCode === "23505") return "That username is taken.";
  if (pgCode === "RL429") return "Too many changes. Try again in an hour.";
  if (pgCode !== "23514" || !pgMessage) return null;
  if (pgMessage.includes("30 days")) return "You can change your username once every 30 days.";
  if (pgMessage.includes("reserved")) return "That username is reserved.";
  if (pgMessage.includes("avatar")) return "That avatar could not be used.";
  if (pgMessage.includes("display name")) return "Remove special characters from your display name.";
  return null;
}

/**
 * Friendly text for Supabase Auth errors. Sign-in failures never say whether
 * the email exists.
 */
export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "That email and password do not match.";
  }
  if (code === "email_not_confirmed") return "Verify your email first. Check your inbox for the link.";
  if (code === "weak_password" || msg.includes("password should")) {
    return "Pick a stronger password: at least 10 characters, and not one that has leaked before.";
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return "An account with that email already exists. Try signing in.";
  }
  if (code === "captcha_failed" || msg.includes("captcha")) return "The bot check failed. Try it again.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err?.status === 429) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (code === "same_password") return "Use a password different from your current one.";
  if (code === "otp_expired" || msg.includes("expired")) return "That link has expired. Ask for a new one.";
  return "Something went wrong. Try again.";
}
