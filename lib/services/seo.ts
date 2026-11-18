/** Search-facing text and structured data for title pages. Pure functions only. */
import { KIND_LABELS } from "./labels";
import { LOW_SAMPLE_THRESHOLD } from "./tally";

type Kind = keyof typeof KIND_LABELS;

/** The question every title page answers, e.g. "Is Die Hard (1988) AI-generated?" */
export function titleQuestion(title: string, year: number | null): string {
  return `Is ${title}${year ? ` (${year})` : ""} AI-generated?`;
}

export interface Faq {
  question: string;
  answer: string;
}

/**
 * The FAQ under each title. Answers describe community opinion and never
 * state as fact whether a work used generative AI.
 */
export function titleFaq(opts: { title: string; year: number | null; kind: Kind; verdict: string; commentCount: number }): Faq[] {
  const work = KIND_LABELS[opts.kind].toLowerCase();
  const named = `${opts.title}${opts.year ? ` (${opts.year})` : ""}`;
  return [
    {
      question: `Did ${named} use generative AI?`,
      answer: `${opts.verdict} This is the view of isMyMediaAI members, not a confirmed fact. ${
        opts.commentCount > 0
          ? `Read the ${opts.commentCount} comment${opts.commentCount === 1 ? "" : "s"} on this page for the evidence behind it.`
          : "No one has shared evidence for this " + work + " yet."
      }`,
    },
    {
      question: "How is the community verdict decided?",
      answer: `Members with verified accounts vote "Uses gen AI", "No gen AI" or "Unsure". The page shows a lean once at least ${LOW_SAMPLE_THRESHOLD} votes are counted and one side has 60% or more. Votes from new accounts count after 72 hours.`,
    },
    {
      question: "Where does the evidence come from?",
      answer:
        "Members link to credits, official statements, interviews or specific analyses in their comments. Comments with an evidence link are shown first.",
    },
    {
      question: "How can I correct this page?",
      answer: `Sign in to vote or add a comment with evidence. To fix the ${work}'s details, use "Report a problem with this title".`,
    },
  ];
}

const SCHEMA_TYPES: Record<Kind, string> = { movie: "Movie", tv_show: "TVSeries", book: "Book" };

export function faqJsonLd(faq: Faq[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** The work itself, so search engines tie the page to the right film, show or book. */
export function workJsonLd(opts: {
  url: string;
  title: string;
  year: number | null;
  kind: Kind;
  coverUrl: string | null;
  synopsis: string | null;
  people: { role: string; name: string }[];
  genres: string[];
}): Record<string, unknown> {
  const names = (roles: string[]) =>
    opts.people.filter((p) => roles.includes(p.role)).map((p) => ({ "@type": "Person", name: p.name }));
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPES[opts.kind],
    name: opts.title,
    url: opts.url,
  };
  if (opts.year) out[opts.kind === "tv_show" ? "startDate" : "datePublished"] = String(opts.year);
  if (opts.coverUrl) out.image = opts.coverUrl;
  if (opts.synopsis) out.description = opts.synopsis.slice(0, 500);
  if (opts.genres.length) out.genre = opts.genres;
  const directors = names(["director"]);
  const creators = names(["creator", "showrunner"]);
  const authors = names(["author"]);
  const actors = names(["actor"]).slice(0, 10);
  if (opts.kind === "movie" && directors.length) out.director = directors;
  if (opts.kind === "tv_show" && creators.length) out.creator = creators;
  if (opts.kind === "book" && authors.length) out.author = authors;
  if (opts.kind !== "book" && actors.length) out.actor = actors;
  return out;
}

/**
 * Serialise structured data for a <script type="application/ld+json"> tag.
 * Escapes the characters that could end the script element or break the
 * JSON in older parsers, so text from members can never become markup.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** "With Dee Rector", or a genre fallback, for related-title links. */
export function relatedReason(sharedPeople: string[], sharedGenres: number): string {
  if (sharedPeople.length === 1) return `With ${sharedPeople[0]}`;
  if (sharedPeople.length === 2) return `With ${sharedPeople[0]} and ${sharedPeople[1]}`;
  if (sharedPeople.length > 2) return `With ${sharedPeople[0]}, ${sharedPeople[1]} and others`;
  return sharedGenres === 1 ? "Same genre" : `${sharedGenres} genres in common`;
}

/** Pages crawlers should not spend time on. */
export const ROBOTS_DISALLOW = ["/api/", "/auth/", "/settings/", "/mod", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/titles/new"];

/** Crawlers named explicitly in robots.txt. GPTBot (model training) is allowed by the owner's choice. */
export const NAMED_CRAWLERS = ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "GPTBot"];

export const PRODUCTION_HOST = "ismymediaai.com";

/** robots.txt rules: open on production, closed everywhere else (staging, previews). */
export function robotsRules(site: string): {
  rules: { userAgent: string; allow?: string; disallow: string | string[] }[];
  sitemap?: string;
  host?: string;
} {
  if (new URL(site).hostname !== PRODUCTION_HOST) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      ...NAMED_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: ROBOTS_DISALLOW })),
      { userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW },
    ],
    sitemap: new URL("/sitemap.xml", site).toString(),
    host: site,
  };
}
