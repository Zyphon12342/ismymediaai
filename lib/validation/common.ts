import { z } from "@/lib/validation/zod";

export const mediaKind = z.enum(["movie", "tv_show", "book", "anime", "manga"]);
export const voteValue = z.enum(["uses_ai", "no_ai", "unsure"]);
export const aiArea = z.enum(["writing", "visuals", "cover_art", "voice", "music", "translation", "marketing", "other"]);

export const uuid = z.uuid();

/** Usernames: 3 to 30 of a-z, 0-9 and underscore, stored lower case. */
export const handle = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, "Use 3 to 30 letters, numbers or underscores.");

/**
 * Evidence links: https only, at most 2,000 characters, normalised (lower
 * case host, no fragment, no credentials, no default port).
 */
export const evidenceUrl = z
  .string()
  .trim()
  .max(2000)
  .transform((value, ctx) => {
    const normalised = normaliseHttpsUrl(value);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: "Use a full https:// link." });
      return z.NEVER;
    }
    return normalised;
  });

export function normaliseHttpsUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) {
    return null;
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.port === "443") url.port = "";
  const out = url.toString();
  return out.length <= 2000 ? out : null;
}

/** Cursor pagination: 20 per page by default, 50 at most. */
export const pageQuery = z.strictObject({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
