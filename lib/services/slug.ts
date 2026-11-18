import { trimEnd, trimStart } from "./text";

/**
 * Make a URL slug from a title and optional year, e.g.
 * ("The Sample Film", 2024) -> "the-sample-film-2024".
 */
export function slugify(title: string, year?: number | null): string {
  const dashed = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-");
  const base = trimEnd(trimStart(dashed, "-").slice(0, 100), "-");
  const withYear = year ? `${base || "untitled"}-${year}` : base || "untitled";
  return withYear;
}
