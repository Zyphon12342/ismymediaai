/** Moderation labels and rules shared by pages, routes and tests. Pure functions only. */
import type { ModActionInput, ReportInput } from "@/lib/validation/moderation";

export const REPORT_REASON_LABELS: Record<ReportInput["reason"], string> = {
  spam: "Spam",
  harassment: "Harassment or a personal attack",
  unsupported_claim: "False or unsupported claim",
  duplicate: "Duplicate entry",
  wrong_details: "Wrong details",
  other: "Something else",
};

/** Every reason the queue can show, including the automatic vote spike check. */
export const QUEUE_REASON_LABELS: Record<ReportInput["reason"] | "vote_spike", string> = {
  ...REPORT_REASON_LABELS,
  vote_spike: "Vote spike",
};

/** Which reasons make sense for each kind of target. */
export const REASONS_FOR: Record<ReportInput["targetType"], ReportInput["reason"][]> = {
  comment: ["spam", "harassment", "unsupported_claim", "other"],
  media: ["duplicate", "wrong_details", "spam", "other"],
  profile: ["spam", "harassment", "other"],
};

export const MOD_ACTION_LABELS: Record<ModActionInput["action"], string> = {
  hide: "Hide",
  restore: "Restore",
  remove: "Remove",
  ban: "Ban",
  unban: "Unban",
  set_trust: "Set trust",
  set_role: "Set role",
  lock_comments: "Lock comments",
  dismiss_report: "Dismiss reports",
};

/** Actions offered in the queue for each kind of target. */
export const ACTIONS_FOR: Record<ModActionInput["targetType"], ModActionInput["action"][]> = {
  comment: ["dismiss_report", "hide", "remove", "restore"],
  media: ["dismiss_report", "hide", "restore", "lock_comments"],
  profile: ["dismiss_report", "ban", "unban", "set_trust"],
};

/** Friendly text for errors raised by reports and public.moderate(). */
export function moderationErrorMessage(pgCode: string | undefined, pgMessage: string | undefined): string | null {
  const msg = pgMessage ?? "";
  if (pgCode === "23505") return "You already reported this. A moderator will look at it.";
  if (pgCode === "RL429") return "Too many reports today. Try again tomorrow.";
  if (pgCode === "P0002") return "That is no longer available.";
  if (msg.includes("only admins")) return "Only admins can do that.";
  if (msg.includes("moderate yourself")) return "You can't moderate your own account.";
  if (msg.includes("merged into itself")) return "Pick a different title to keep.";
  if (msg.includes("already merged")) return "That title was already merged.";
  if (msg.includes("must be published and not merged")) return "The title to keep must be published and not merged itself.";
  if (msg.includes("same kind")) return "Both titles must be the same kind (film, show or book).";
  if (pgCode === "22023") return "That action doesn't fit this item.";
  if (pgCode === "42501") return "Moderators only.";
  return null;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The slug from what a moderator pastes as the title to keep: a slug, a
 * /titles/... path or a full link to a title page. Null when it is none.
 */
export function slugFromTitleRef(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  const m = /^\/?titles\/([^/?#]+)\/?$/.exec(path);
  const slug = (m?.[1] ?? path).toLowerCase();
  return SLUG.test(slug) && slug.length <= 120 ? slug : null;
}
