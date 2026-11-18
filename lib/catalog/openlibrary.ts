import { CatalogError, type FetchLike, type LookupDetail, type LookupResult } from "./types";
import { arr, clip, firstDistinct, isRecord, yearOf } from "./util";

export const OPEN_LIBRARY = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
// Open Library asks API users to identify themselves.
const USER_AGENT = "isMyMediaAI/1.0 (+https://ismymediaai.com)";

/** Open Library subjects to our book genres, matched as lower-case substrings, first match wins per subject. */
const SUBJECTS: [string, string][] = [
  ["science fiction", "sci-fi"], ["fantasy", "fantasy"], ["horror", "horror"], ["romance", "romance"],
  ["thriller", "thriller"], ["suspense", "thriller"], ["mystery", "mystery"], ["detective", "mystery"],
  ["crime", "crime"], ["historical", "history"], ["history", "history"], ["autobiography", "biography"],
  ["biography", "biography"], ["poetry", "poetry"], ["self-help", "self-help"], ["young adult", "young-adult"],
  ["juvenile", "childrens"], ["children", "childrens"], ["humor", "comedy"], ["comedy", "comedy"],
  ["nonfiction", "non-fiction"], ["non-fiction", "non-fiction"], ["adventure", "action"], ["drama", "drama"],
];

export function mapSubjects(subjects: string[]): string[] {
  return firstDistinct(
    subjects.flatMap((s) => {
      const l = s.toLowerCase();
      const hit = SUBJECTS.find(([k]) => l.includes(k));
      return hit ? [hit[1]] : [];
    }),
    3,
  );
}

export function isWorkId(id: string): boolean {
  return /^OL\d{1,12}W$/.test(id);
}

function cover(id: unknown): string | null {
  return typeof id === "number" && id > 0 ? `${COVERS}/${id}-L.jpg` : null;
}

function workId(key: unknown): string | null {
  const m = typeof key === "string" ? /^\/works\/(OL\d{1,12}W)$/.exec(key) : null;
  return m ? m[1]! : null;
}

export function parseOpenLibrarySearch(body: unknown): LookupResult[] {
  if (!isRecord(body)) return [];
  return arr(body.docs)
    .filter(isRecord)
    .slice(0, 10)
    .flatMap((d) => {
      const id = workId(d.key);
      const title = clip(d.title, 300);
      if (!id || !title) return [];
      const authors = arr(d.author_name).filter((a): a is string => typeof a === "string");
      return [
        {
          source: "openlibrary" as const,
          externalId: id,
          kind: "book" as const,
          title,
          year: yearOf(d.first_publish_year),
          coverUrl: cover(d.cover_i),
          byline: authors.length ? authors.slice(0, 2).join(", ") : null,
        },
      ];
    });
}

/** Combine the work record (description, subjects) with its search row (authors, year, cover). */
export function parseOpenLibraryDetail(work: unknown, searchRow: unknown): LookupDetail {
  if (!isRecord(work)) throw new CatalogError("Unexpected Open Library response.");
  const id = workId(work.key);
  if (!id) throw new CatalogError("Unexpected Open Library response.");
  const row = isRecord(searchRow) ? searchRow : {};
  const description = isRecord(work.description) ? work.description.value : work.description;
  const names = arr(row.author_name).filter((a): a is string => typeof a === "string");
  const keys = arr(row.author_key).filter((a): a is string => typeof a === "string");
  const credits = names.slice(0, 10).flatMap((name, i) => {
    const n = clip(name, 300);
    const key = keys[i];
    return n
      ? [{ name: n, kind: "person" as const, role: "author" as const, ...(key && /^OL\d{1,12}A$/.test(key) ? { externalId: key } : {}) }]
      : [];
  });
  const coverId = arr(work.covers).find((c) => typeof c === "number" && c > 0) ?? row.cover_i;
  return {
    source: "openlibrary",
    externalId: id,
    kind: "book",
    title: clip(work.title, 300) ?? clip(row.title, 300) ?? "Untitled",
    originalTitle: null,
    year: yearOf(row.first_publish_year) ?? yearOf(work.first_publish_date),
    coverUrl: cover(coverId),
    byline: names.slice(0, 2).join(", ") || null,
    // Open Library descriptions often end with source notes; keep the text only.
    synopsis: clip(typeof description === "string" ? description.split(/\n-{3,}\n|\(\[source\]/)[0] : null, 5000),
    genres: mapSubjects(arr(work.subjects).filter((s): s is string => typeof s === "string")),
    credits,
  };
}

export class OpenLibraryClient {
  constructor(private readonly fetchFn: FetchLike = fetch) {}

  private async get(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = `${OPEN_LIBRARY}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
    const res = await this.fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) throw new CatalogError("Not found in Open Library.", 404);
    if (!res.ok) throw new CatalogError("Open Library is not answering right now.");
    return res.json();
  }

  private static readonly FIELDS = "key,title,author_name,author_key,first_publish_year,cover_i";

  async search(q: string): Promise<LookupResult[]> {
    return parseOpenLibrarySearch(await this.get("/search.json", { q, fields: OpenLibraryClient.FIELDS, limit: "10" }));
  }

  async detail(externalId: string): Promise<LookupDetail> {
    if (!isWorkId(externalId)) throw new CatalogError("Invalid Open Library id.", 400);
    const [work, search] = await Promise.all([
      this.get(`/works/${externalId}.json`),
      this.get("/search.json", { q: `key:/works/${externalId}`, fields: OpenLibraryClient.FIELDS, limit: "1" }),
    ]);
    return parseOpenLibraryDetail(work, isRecord(search) ? arr(search.docs)[0] : null);
  }
}
