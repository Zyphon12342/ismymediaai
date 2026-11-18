import { z } from "@/lib/validation/zod";
import { mediaKind } from "./common";

export const catalogSource = z.enum(["tmdb", "openlibrary", "anilist"]);
export const creditRole = z.enum([
  "actor", "director", "creator", "writer", "showrunner", "composer",
  "author", "illustrator", "translator", "studio", "network", "publisher",
]);
export const genreSlug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(50);
export const genreList = z
  .array(genreSlug)
  .min(1, "Pick at least 1 genre.")
  .max(3, "Pick at most 3 genres.")
  .refine((g) => new Set(g).size === g.length, "Each genre once.");

const searchText = z.string().trim().min(1, "Type a title.").max(100);

export const LookupQuery = z.strictObject({ kind: mediaKind, q: searchText });
export const LookupDetailQuery = z.strictObject({
  source: catalogSource,
  id: z.string().regex(/^((movie|tv|anime|manga)\/\d{1,10}|OL\d{1,12}W)$/, "Invalid id."),
});

const COMPANY_ROLES = new Set(["studio", "network", "publisher"]);

export const ManualCredit = z.strictObject({
  name: z.string().trim().min(1).max(300),
  role: creditRole,
});

/**
 * POST /api/media. Catalogue entries send only the id and genres: the
 * server fetches the details itself, so titles and credits cannot be forged.
 * Manual entries go to review.
 */
export const CreateMediaInput = z.discriminatedUnion("source", [
  z.strictObject({
    source: catalogSource,
    externalId: LookupDetailQuery.shape.id,
    genres: genreList,
  }),
  z.strictObject({
    source: z.literal("manual"),
    kind: mediaKind,
    title: z.string().trim().min(1, "Enter a title.").max(300),
    year: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
    synopsis: z.string().trim().max(5000).nullable().optional(),
    genres: genreList,
    credits: z.array(ManualCredit).max(20).default([]),
  }),
]);
export type CreateMediaInput = z.infer<typeof CreateMediaInput>;

export const browseSort = z.enum(["newest", "most_voted", "most_disputed", "relevance"]);

export const BrowseQuery = z.object({
  q: z.string().trim().max(100).optional().transform((v) => (v ? v : undefined)),
  kind: mediaKind.optional().catch(undefined),
  genre: genreSlug.optional().catch(undefined),
  sort: browseSort.optional().catch(undefined),
  cursor: z.string().max(40).optional(),
});
export type BrowseQuery = z.infer<typeof BrowseQuery>;

export function isCompanyRole(role: string): boolean {
  return COMPANY_ROLES.has(role);
}
