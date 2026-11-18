/**
 * Recorded-style catalogue responses for local previews and CI, so tests
 * never call TMDB or Open Library. Titles and people here are fictional.
 */
import type { FetchLike } from "./types";

const movies = [
  {
    id: 900001, title: "The Sample Film", original_title: "The Sample Film", release_date: "2031-05-02",
    poster_path: "/sample-film.jpg", overview: "A projectionist finds a reel that was never shot.",
    genres: [{ id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }],
    production_companies: [{ id: 7001, name: "Placeholder Pictures" }],
    credits: {
      cast: [
        { id: 8001, name: "Ada Placeholder", character: "Projectionist", order: 0 },
        { id: 8002, name: "Ben Fixture", character: "Archivist", order: 1 },
      ],
      crew: [
        { id: 8003, name: "Cleo Director", job: "Director", department: "Directing" },
        { id: 8004, name: "Dev Writer", job: "Screenplay", department: "Writing" },
        { id: 8005, name: "Eli Composer", job: "Original Music Composer", department: "Sound" },
      ],
    },
  },
  {
    id: 900002, title: "Sample Film Two", original_title: "Sample Film Two", release_date: "2033-11-20",
    poster_path: null, overview: "The reel returns.", genres: [{ id: 53, name: "Thriller" }],
    production_companies: [], credits: { cast: [], crew: [{ id: 8003, name: "Cleo Director", job: "Director", department: "Directing" }] },
  },
];

const shows = [
  {
    id: 910001, name: "Example Street", original_name: "Example Street", first_air_date: "2030-01-09",
    poster_path: "/example-street.jpg", overview: "Neighbours on a street that only exists in tests.",
    genres: [{ id: 35, name: "Comedy" }, { id: 18, name: "Drama" }],
    created_by: [{ id: 8101, name: "Fay Creator" }], networks: [{ id: 7101, name: "Test Network" }],
    production_companies: [],
    credits: { cast: [{ id: 8102, name: "Gus Neighbour", character: "Gus", order: 0 }], crew: [] },
  },
];

const books = [
  {
    key: "/works/OL900001W", title: "A Book of Examples", author_name: ["Hana Author"], author_key: ["OL900001A"],
    first_publish_year: 2029, cover_i: 900001,
    work: { description: { value: "Essays on things that are only examples." }, subjects: ["Science fiction", "Essays"], covers: [900001] },
  },
  {
    key: "/works/OL900002W", title: "Fixture Poems", author_name: ["Ivo Poet", "Jun Poet"], author_key: ["OL900002A", "OL900003A"],
    first_publish_year: 2032, cover_i: null, work: { description: "Short poems.", subjects: ["Poetry"], covers: [] },
  },
];

function match(q: string | null, title: string): boolean {
  const words = (q ?? "").toLowerCase().split(/\W+/).filter(Boolean);
  return words.every((w) => title.toLowerCase().includes(w));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const fixtureFetch: FetchLike = async (input) => {
  const url = new URL(input);
  const q = url.searchParams.get("query") ?? url.searchParams.get("q");
  let m: RegExpExecArray | null;

  if (url.hostname === "api.themoviedb.org") {
    if (url.pathname === "/3/search/movie") return json({ results: movies.filter((x) => match(q, x.title)) });
    if (url.pathname === "/3/search/tv") return json({ results: shows.filter((x) => match(q, x.name)) });
    const page = Number(url.searchParams.get("page") ?? "1");
    if (url.pathname === "/3/movie/popular") return json({ results: page === 1 ? movies : [] });
    if (url.pathname === "/3/tv/popular") return json({ results: page === 1 ? shows : [] });
    if (url.pathname === "/3/movie/now_playing") return json({ results: page === 1 ? movies.slice(1) : [] });
    if (url.pathname === "/3/trending/movie/week") return json({ results: movies });
    if (url.pathname === "/3/trending/tv/week") return json({ results: shows });
    if ((m = /^\/3\/movie\/(\d+)$/.exec(url.pathname))) {
      const hit = movies.find((x) => x.id === Number(m![1]));
      return hit ? json(hit) : json({ status_message: "not found" }, 404);
    }
    if ((m = /^\/3\/tv\/(\d+)$/.exec(url.pathname))) {
      const hit = shows.find((x) => x.id === Number(m![1]));
      return hit ? json(hit) : json({ status_message: "not found" }, 404);
    }
  }
  if (url.hostname === "openlibrary.org") {
    if (url.pathname === "/search.json") {
      const key = /^key:(\/works\/OL\d+W)$/.exec(q ?? "")?.[1];
      const docs = books.filter((b) => (key ? b.key === key : match(q, b.title)));
      return json({ docs: docs.map((d) => ({ key: d.key, title: d.title, author_name: d.author_name, author_key: d.author_key, first_publish_year: d.first_publish_year, cover_i: d.cover_i })) });
    }
    if (/^\/trending\/(daily|weekly|monthly|yearly)\.json$/.test(url.pathname)) return json({ works: books.map((b) => ({ key: b.key, title: b.title })) });
    if ((m = /^\/works\/(OL\d+W)\.json$/.exec(url.pathname))) {
      const hit = books.find((b) => b.key === `/works/${m![1]}`);
      return hit ? json({ key: hit.key, title: hit.title, ...hit.work }) : json({ error: "notfound" }, 404);
    }
  }
  return json({ error: "no fixture" }, 404);
};
