import { CatalogError, type CreditInput, type FetchLike, type LookupDetail, type LookupResult } from "./types";
import { arr, clip, firstDistinct, isRecord, yearOf } from "./util";

export const TMDB_API = "https://api.themoviedb.org/3";
const POSTER = "https://image.tmdb.org/t/p/w500";

type TmdbKind = "movie" | "tv";

/** TMDB genre ids to our curated slugs. Unlisted ids (Music, Reality, Talk...) map to nothing. */
const GENRES: Record<number, string[]> = {
  28: ["action"], 12: ["action"], 16: ["animation"], 35: ["comedy"], 80: ["crime"], 99: ["documentary"],
  18: ["drama"], 10751: ["family"], 14: ["fantasy"], 36: ["history"], 27: ["horror"], 9648: ["mystery"],
  10749: ["romance"], 878: ["sci-fi"], 53: ["thriller"], 10752: ["history"],
  10759: ["action"], 10762: ["family"], 10763: ["documentary"], 10765: ["sci-fi", "fantasy"],
  10766: ["drama"], 10768: ["history"],
};

export function mapTmdbGenres(ids: number[]): string[] {
  return firstDistinct(ids.flatMap((id) => GENRES[id] ?? []), 3);
}

/** "movie/603" or "tv/1399": movie and TV ids overlap on TMDB, so the type is part of the id. */
export function parseTmdbId(externalId: string): { type: TmdbKind; id: number } | null {
  const m = /^(movie|tv)\/(\d{1,10})$/.exec(externalId);
  return m ? { type: m[1] as TmdbKind, id: Number(m[2]) } : null;
}

function poster(path: unknown): string | null {
  return typeof path === "string" && /^\/[A-Za-z0-9_.-]+$/.test(path) ? `${POSTER}${path}` : null;
}

export function parseTmdbSearch(type: TmdbKind, body: unknown): LookupResult[] {
  if (!isRecord(body)) return [];
  return arr(body.results)
    .filter(isRecord)
    .slice(0, 10)
    .flatMap((r) => {
      const title = clip(type === "movie" ? r.title : r.name, 300);
      if (typeof r.id !== "number" || !title) return [];
      return [
        {
          source: "tmdb" as const,
          externalId: `${type}/${r.id}`,
          kind: type === "movie" ? ("movie" as const) : ("tv_show" as const),
          title,
          year: yearOf(type === "movie" ? r.release_date : r.first_air_date),
          coverUrl: poster(r.poster_path),
          byline: null,
        },
      ];
    });
}

function person(p: Record<string, unknown>): { id: number; name: string } | null {
  const name = clip(p.name, 300);
  return typeof p.id === "number" && name ? { id: p.id, name } : null;
}

export function parseTmdbDetail(type: TmdbKind, body: unknown): LookupDetail {
  if (!isRecord(body) || typeof body.id !== "number") throw new CatalogError("Unexpected TMDB response.");
  const credits = isRecord(body.credits) ? body.credits : {};
  const cast = arr(credits.cast).filter(isRecord);
  const crew = arr(credits.crew).filter(isRecord);
  const out: CreditInput[] = [];
  const add = (c: CreditInput) => {
    if (!out.some((x) => x.externalId === c.externalId && x.role === c.role)) out.push(c);
  };

  if (type === "tv") {
    for (const c of arr(body.created_by).filter(isRecord)) {
      const p = person(c);
      if (p) add({ name: p.name, kind: "person", role: "creator", externalId: `person/${p.id}` });
    }
  }
  for (const c of crew) {
    const p = person(c);
    if (!p) continue;
    if (c.job === "Director") add({ name: p.name, kind: "person", role: "director", externalId: `person/${p.id}` });
    else if (c.department === "Writing" && ["Screenplay", "Writer", "Story", "Novel"].includes(String(c.job)))
      add({ name: p.name, kind: "person", role: "writer", externalId: `person/${p.id}` });
    else if (c.job === "Original Music Composer" || c.job === "Music")
      add({ name: p.name, kind: "person", role: "composer", externalId: `person/${p.id}` });
  }
  const people = out.filter((c) => c.role !== "actor").slice(0, 12);
  const actors: CreditInput[] = cast
    .map((c, i) => ({ c, p: person(c), order: typeof c.order === "number" ? c.order : i }))
    .filter((x) => x.p)
    .sort((a, b) => a.order - b.order)
    .slice(0, 12)
    .map(({ c, p, order }) => ({
      name: p!.name,
      kind: "person" as const,
      role: "actor" as const,
      externalId: `person/${p!.id}`,
      billingOrder: Math.min(order, 32767),
      ...(clip(c.character, 300) ? { characterName: clip(c.character, 300)! } : {}),
    }));
  const companies: CreditInput[] = arr(body.production_companies)
    .filter(isRecord)
    .slice(0, 3)
    .flatMap((c) => {
      const p = person(c);
      return p ? [{ name: p.name, kind: "company" as const, role: "studio" as const, externalId: `company/${p.id}` }] : [];
    });
  const networks: CreditInput[] =
    type === "tv"
      ? arr(body.networks)
          .filter(isRecord)
          .slice(0, 2)
          .flatMap((c) => {
            const p = person(c);
            return p ? [{ name: p.name, kind: "company" as const, role: "network" as const, externalId: `network/${p.id}` }] : [];
          })
      : [];

  const title = clip(type === "movie" ? body.title : body.name, 300) ?? "Untitled";
  const original = clip(type === "movie" ? body.original_title : body.original_name, 300);
  const director = people.find((c) => c.role === "director" || c.role === "creator");
  return {
    source: "tmdb",
    externalId: `${type}/${body.id}`,
    kind: type === "movie" ? "movie" : "tv_show",
    title,
    originalTitle: original && original !== title ? original : null,
    year: yearOf(type === "movie" ? body.release_date : body.first_air_date),
    coverUrl: poster(body.poster_path),
    byline: director?.name ?? null,
    synopsis: clip(body.overview, 5000),
    genres: mapTmdbGenres(arr(body.genres).flatMap((g) => (isRecord(g) && typeof g.id === "number" ? [g.id] : []))),
    credits: [...people, ...actors, ...companies, ...networks].slice(0, 40),
  };
}

export class TmdbClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = `${TMDB_API}${path}?${new URLSearchParams(params)}`;
    const res = await this.fetchFn(url, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) throw new CatalogError("Not found in TMDB.", 404);
    if (!res.ok) throw new CatalogError("TMDB is not answering right now.");
    return res.json();
  }

  async search(kind: "movie" | "tv_show", q: string): Promise<LookupResult[]> {
    const type: TmdbKind = kind === "movie" ? "movie" : "tv";
    return parseTmdbSearch(type, await this.get(`/search/${type}`, { query: q, include_adult: "false", page: "1" }));
  }

  /** TMDB's current popular list, 20 per page. Used to seed a new catalogue. */
  async popular(kind: "movie" | "tv_show", page = 1): Promise<LookupResult[]> {
    const type: TmdbKind = kind === "movie" ? "movie" : "tv";
    return parseTmdbSearch(type, await this.get(`/${type}/popular`, { page: String(page) }));
  }

  /** Movies in cinemas now. */
  async nowPlaying(page = 1): Promise<LookupResult[]> {
    return parseTmdbSearch("movie", await this.get("/movie/now_playing", { page: String(page) }));
  }

  /** What people are watching this week. */
  async trending(kind: "movie" | "tv_show"): Promise<LookupResult[]> {
    const type: TmdbKind = kind === "movie" ? "movie" : "tv";
    return parseTmdbSearch(type, await this.get(`/trending/${type}/week`, {}));
  }

  async detail(externalId: string): Promise<LookupDetail> {
    const id = parseTmdbId(externalId);
    if (!id) throw new CatalogError("Invalid TMDB id.", 400);
    return parseTmdbDetail(id.type, await this.get(`/${id.type}/${id.id}`, { append_to_response: "credits" }));
  }
}
