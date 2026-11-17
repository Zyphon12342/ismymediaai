/**
 * Make a URL slug from a title and optional year, e.g.
 * ("The Sample Film", 2024) -> "the-sample-film-2024".
 */
export function slugify(title: string, year?: number | null): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
  const withYear = year ? `${base || "untitled"}-${year}` : base || "untitled";
  return withYear;
}
