import { CatalogError, type CreditInput, type FetchLike, type LookupDetail, type LookupResult } from "./types";
import { arr, clip, firstDistinct, isRecord, yearOf } from "./util";

/** AniList's public GraphQL API: free, no key, about 90 requests a minute. */
export const ANILIST_API = "https://graphql.anilist.co";

export type AniListType = "anime" | "manga";

/** AniList genres to our curated slugs. Ecchi, Music and Hentai map to nothing. */
const GENRES: Record<string, string[]> = {
  Action: ["action"], Adventure: ["action"], Comedy: ["comedy"], Drama: ["drama"], Fantasy: ["fantasy"],
  "Mahou Shoujo": ["fantasy"], Supernatural: ["fantasy"], Horror: ["horror"], Mecha: ["mecha"], Mystery: ["mystery"],
  Psychological: ["psychological"], Romance: ["romance"], "Sci-Fi": ["sci-fi"], "Slice of Life": ["slice-of-life"],
  Sports: ["sports"], Thriller: ["thriller"],
};

export function mapAniListGenres(genres: string[]): string[] {
  return firstDistinct(genres.flatMap((g) => GENRES[g] ?? []), 3);
}

/** "anime/21" or "manga/30013". AniList ids are unique across both, but the type keeps lookups explicit. */
export function parseAniListId(externalId: string): { type: AniListType; id: number } | null {
  const m = /^(anime|manga)\/(\d{1,10})$/.exec(externalId);
  return m ? { type: m[1] as AniListType, id: Number(m[2]) } : null;
}

function cover(img: unknown): string | null {
  if (!isRecord(img)) return null;
  const url = [img.extraLarge, img.large].find((u): u is string => typeof u === "string");
  return url && /^https:\/\/s4\.anilist\.co\/[A-Za-z0-9_./-]+$/.test(url) ? url : null;
}

interface Titles {
  title: string;
  originalTitle: string | null;
  /** Every name AniList gives, for spotting the same work on TMDB or Open Library. */
  all: string[];
}

/** English title when there is one, else the romaji; the romaji (or native) is kept as the original title. */
function titles(t: unknown, synonyms: unknown = []): Titles | null {
  if (!isRecord(t)) return null;
  const english = clip(t.english, 300);
  const romaji = clip(t.romaji, 300);
  const native = clip(t.native, 300);
  const title = english ?? romaji ?? native;
  if (!title) return null;
  const original = [romaji, native].find((x) => x && x !== title) ?? null;
  const syn = arr(synonyms).flatMap((s) => (clip(s, 300) ? [clip(s, 300)!] : []));
  return { title, originalTitle: original, all: firstDistinct([english, romaji, native, ...syn].filter((x): x is string => !!x), 8) };
}

function studioName(m: Record<string, unknown>): string | null {
  const studios = isRecord(m.studios) ? arr(m.studios.nodes).filter(isRecord) : [];
  return clip(studios[0]?.name, 300);
}

function staffName(n: unknown): string | null {
  return isRecord(n) && isRecord(n.name) ? clip(n.name.full, 300) : null;
}

/** AniList staff roles look like "Director", "Story & Art", "Original Creator", "Translator (English)". */
function rolesFor(type: AniListType, role: string): CreditInput["role"][] {
  const r = role.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
  if (type === "anime") {
    if (r === "director" || r === "chief director") return ["director"];
    if (r === "original creator" || r === "original story" || r === "original work") return ["creator"];
    if (r === "series composition" || r === "script" || r === "screenplay") return ["writer"];
    if (r === "music") return ["composer"];
    return [];
  }
  if (r === "story & art") return ["author", "illustrator"];
  if (r === "story" || r === "original story" || r === "original creator") return ["author"];
  if (r === "art") return ["illustrator"];
  if (r === "translator") return ["translator"];
  return [];
}

export function parseAniListSearch(type: AniListType, body: unknown, max = 10): LookupResult[] {
  const page = isRecord(body) && isRecord(body.data) && isRecord(body.data.Page) ? body.data.Page : null;
  if (!page) return [];
  return arr(page.media)
    .filter(isRecord)
    .filter((m) => m.isAdult !== true)
    .slice(0, max)
    .flatMap((m) => {
      const t = titles(m.title, m.synonyms);
      if (typeof m.id !== "number" || !t) return [];
      const staff = isRecord(m.staff) ? arr(m.staff.edges).filter(isRecord) : [];
      const byline = type === "anime" ? studioName(m) : staffName(staff[0]?.node);
      return [
        {
          source: "anilist" as const,
          externalId: `${type}/${m.id}`,
          kind: type,
          title: t.title,
          year: yearOf(isRecord(m.startDate) ? m.startDate.year : null),
          coverUrl: cover(m.coverImage),
          byline,
          altTitles: t.all,
        },
      ];
    });
}

/** AniList descriptions carry light HTML and a trailing "(Source: ...)" note; keep the text only. */
export function cleanDescription(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const text = d
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\(\s*Source:[^)]*\)\s*$/i, "")
    .replace(/\[?Written by MAL Rewrite\]?\s*$/i, "");
  return clip(text, 5000);
}

export function parseAniListDetail(type: AniListType, body: unknown): LookupDetail {
  const m = isRecord(body) && isRecord(body.data) && isRecord(body.data.Media) ? body.data.Media : null;
  if (!m || typeof m.id !== "number") throw new CatalogError("Unexpected AniList response.");
  if (m.isAdult === true) throw new CatalogError("Not found in AniList.", 404);
  const t = titles(m.title, m.synonyms);
  if (!t) throw new CatalogError("Unexpected AniList response.");

  const out: CreditInput[] = [];
  const add = (c: CreditInput) => {
    if (!out.some((x) => x.externalId === c.externalId && x.role === c.role)) out.push(c);
  };
  for (const e of isRecord(m.staff) ? arr(m.staff.edges).filter(isRecord) : []) {
    const name = staffName(e.node);
    const id = isRecord(e.node) ? e.node.id : null;
    if (!name || typeof id !== "number" || typeof e.role !== "string") continue;
    for (const role of rolesFor(type, e.role)) add({ name, kind: "person", role, externalId: `staff/${id}` });
  }
  const people = out.slice(0, 12);

  // Anime: the Japanese voice cast, by character importance.
  const actors: CreditInput[] = [];
  if (type === "anime") {
    const edges = isRecord(m.characters) ? arr(m.characters.edges).filter(isRecord) : [];
    edges.forEach((e, i) => {
      const character = isRecord(e.node) && isRecord(e.node.name) ? clip(e.node.name.full, 300) : null;
      const va = arr(e.voiceActors).filter(isRecord)[0];
      const name = staffName(va);
      if (!va || !name || typeof va.id !== "number" || actors.length >= 12) return;
      if (actors.some((a) => a.externalId === `staff/${va.id}`)) return;
      actors.push({ name, kind: "person", role: "actor", externalId: `staff/${va.id}`, billingOrder: i, ...(character ? { characterName: character } : {}) });
    });
  }

  const studios: CreditInput[] =
    type === "anime" && isRecord(m.studios)
      ? arr(m.studios.edges)
          .filter(isRecord)
          .filter((e) => e.isMain === true && isRecord(e.node))
          .slice(0, 3)
          .flatMap((e) => {
            const n = e.node as Record<string, unknown>;
            const name = clip(n.name, 300);
            return name && typeof n.id === "number" ? [{ name, kind: "company" as const, role: "studio" as const, externalId: `studio/${n.id}` }] : [];
          })
      : [];

  const byline =
    type === "anime"
      ? (studios[0]?.name ?? people.find((c) => c.role === "director")?.name ?? null)
      : (people.find((c) => c.role === "author")?.name ?? null);
  return {
    source: "anilist",
    externalId: `${type}/${m.id}`,
    kind: type,
    title: t.title,
    originalTitle: t.originalTitle,
    year: yearOf(isRecord(m.startDate) ? m.startDate.year : null),
    coverUrl: cover(m.coverImage),
    byline,
    altTitles: t.all,
    synopsis: cleanDescription(m.description),
    genres: mapAniListGenres(arr(m.genres).filter((g): g is string => typeof g === "string")),
    credits: [...people, ...actors, ...studios].slice(0, 40),
  };
}

const CARD = `id isAdult title { romaji english native } synonyms startDate { year } coverImage { extraLarge large }
  studios(isMain: true) { nodes { name } } staff(perPage: 1, sort: RELEVANCE) { edges { node { name { full } } } }`;

const SEARCH = `query ($q: String, $type: MediaType) {
  Page(perPage: 10) { media(search: $q, type: $type, isAdult: false, sort: SEARCH_MATCH) { ${CARD} } }
}`;

const TRENDING = `query ($type: MediaType, $perPage: Int) {
  Page(perPage: $perPage) { media(type: $type, isAdult: false, sort: TRENDING_DESC) { ${CARD} } }
}`;

const POPULAR = `query ($type: MediaType, $page: Int) {
  Page(page: $page, perPage: 20) { media(type: $type, isAdult: false, sort: POPULARITY_DESC) { ${CARD} } }
}`;

const DETAIL = `query ($id: Int, $type: MediaType) {
  Media(id: $id, type: $type) {
    id isAdult title { romaji english native } synonyms startDate { year } coverImage { extraLarge large }
    description(asHtml: false) genres
    studios { edges { isMain node { id name } } }
    staff(perPage: 25, sort: [RELEVANCE, ID]) { edges { role node { id name { full } } } }
    characters(perPage: 12, sort: [ROLE, RELEVANCE, ID]) {
      edges { node { name { full } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } } }
    }
  }
}`;

export class AniListClient {
  constructor(private readonly fetchFn: FetchLike = fetch) {}

  private async query(query: string, variables: Record<string, unknown>): Promise<unknown> {
    const res = await this.fetchFn(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) throw new CatalogError("Not found in AniList.", 404);
    if (res.status === 429) throw new CatalogError("AniList is busy. Try again in a minute.", 503);
    if (!res.ok) throw new CatalogError("AniList is not answering right now.");
    return res.json();
  }

  async search(type: AniListType, q: string): Promise<LookupResult[]> {
    return parseAniListSearch(type, await this.query(SEARCH, { q, type: type.toUpperCase() }));
  }

  /** What's trending on AniList right now. */
  async trending(type: AniListType, perPage = 20): Promise<LookupResult[]> {
    return parseAniListSearch(type, await this.query(TRENDING, { type: type.toUpperCase(), perPage: Math.min(perPage, 50) }), 50);
  }

  /** All-time most popular, 20 per page. Used to seed a new catalogue. */
  async popular(type: AniListType, page = 1): Promise<LookupResult[]> {
    return parseAniListSearch(type, await this.query(POPULAR, { type: type.toUpperCase(), page }), 50);
  }

  async detail(externalId: string): Promise<LookupDetail> {
    const id = parseAniListId(externalId);
    if (!id) throw new CatalogError("Invalid AniList id.", 400);
    return parseAniListDetail(id.type, await this.query(DETAIL, { id: id.id, type: id.type.toUpperCase() }));
  }
}
