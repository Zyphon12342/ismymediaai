/** Comment rules shared by pages, routes and tests. Pure functions only. */
import type { CommentInput, CommentUpdate } from "@/lib/validation/comment";
import { titlePath } from "./labels";
import { trimEnd } from "./text";

export const EDIT_MINUTES = 15;
/** Turnstile is required for a user's first few comments. */
export const TURNSTILE_COMMENTS = 3;

export const AI_AREA_LABELS = {
  writing: "Writing",
  visuals: "Visuals",
  cover_art: "Cover art",
  voice: "Voice",
  music: "Music",
  translation: "Translation",
  marketing: "Marketing",
  other: "Other",
} as const;

export function canEditComment(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= EDIT_MINUTES * 60_000;
}

export function needsCommentTurnstile(commentCount: number): boolean {
  return commentCount < TURNSTILE_COMMENTS;
}

export function commentAnchor(id: string): string {
  return `comment-${id}`;
}

export function commentPermalink(slug: string, id: string): string {
  return `${titlePath(slug)}#${commentAnchor(id)}`;
}

export type BodyPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const TRAILING_PUNCTUATION = ".,;:!?)]}>'\"";

/**
 * Split plain text into text and link parts. Only http(s) URLs become links;
 * everything else stays text, so nothing in a comment is ever parsed as HTML.
 */
export function linkify(text: string): BodyPart[] {
  const parts: BodyPart[] = [];
  const push = (value: string) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last?.type === "text") last.value += value;
    else parts.push({ type: "text", value });
  };
  for (const piece of text.split(/(\s+)/)) {
    const start = piece.search(/https?:\/\//);
    if (start === -1) {
      push(piece);
      continue;
    }
    const candidate = trimEnd(piece.slice(start), TRAILING_PUNCTUATION);
    let href: string | null = null;
    try {
      const url = new URL(candidate);
      if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".")) href = url.toString();
    } catch {
      href = null;
    }
    if (!href) {
      push(piece);
      continue;
    }
    push(piece.slice(0, start));
    parts.push({ type: "link", value: candidate, href });
    push(piece.slice(start + candidate.length));
  }
  return parts;
}

/** Map a validated comment body to table columns. */
export function toCommentRow(input: CommentInput | CommentUpdate): {
  body?: string;
  evidence_url?: string | null;
  ai_areas?: CommentInput["aiAreas"];
} {
  const row: ReturnType<typeof toCommentRow> = {};
  if (input.body !== undefined) row.body = input.body;
  if (input.evidenceUrl !== undefined) row.evidence_url = input.evidenceUrl;
  if (input.aiAreas !== undefined) row.ai_areas = input.aiAreas;
  return row;
}

/** Friendly text for database rule violations raised by comment writes. */
export function commentErrorMessage(pgCode: string | undefined, pgMessage: string | undefined): string | null {
  const msg = pgMessage ?? "";
  if (pgCode === "RL429") return "You're commenting a lot. Try again in an hour.";
  if (msg.includes("blocked word")) return "Your comment contains a word that isn't allowed here.";
  if (msg.includes("domain is blocked")) return "That evidence link's site isn't allowed.";
  if (msg.includes("15 minutes")) return `Comments can only be edited for ${EDIT_MINUTES} minutes.`;
  if (msg.includes("one level deep")) return "You can only reply to top-level comments.";
  if (msg.includes("same title")) return "That reply belongs to another title.";
  if (msg.includes("locked")) return "Comments are locked on this title.";
  if (pgCode === "42501") return "You can't comment here.";
  return null;
}
