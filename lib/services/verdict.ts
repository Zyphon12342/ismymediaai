import { formatDate } from "./account";
import { summarizeTally, type Tally } from "./tally";

export const MAJORITY = 60;

export type VerdictKind = "none" | "too_few" | "uses_ai" | "no_ai" | "split";

/** How the community leans, from counted votes only. Never stated as fact. */
export function verdictKind(t: Tally): VerdictKind {
  const s = summarizeTally(t);
  if (s.total === 0) return "none";
  if (s.lowSample) return "too_few";
  if (s.percent.uses_ai >= MAJORITY) return "uses_ai";
  if (s.percent.no_ai >= MAJORITY) return "no_ai";
  return "split";
}

/** One sentence under the title's question, e.g. for search snippets. */
export function verdictSentence(t: Tally, opts: { updatedAt?: Date | null; underReview?: boolean } = {}): string {
  const s = summarizeTally(t);
  const votes = `${s.total} vote${s.total === 1 ? "" : "s"}`;
  const asOf = opts.updatedAt ? `, as of ${formatDate(opts.updatedAt)}` : "";
  let out: string;
  switch (verdictKind(t)) {
    case "none":
      out = "No community votes yet. Vote and share evidence to start the verdict.";
      break;
    case "too_few":
      out = `Too few votes for a community verdict yet: ${votes} so far${asOf}.`;
      break;
    case "uses_ai":
      out = `Community votes say it likely used generative AI: ${s.percent.uses_ai}% of ${votes}${asOf}.`;
      break;
    case "no_ai":
      out = `Community votes say it likely did not use generative AI: ${s.percent.no_ai}% of ${votes}${asOf}.`;
      break;
    default:
      out = `Community votes are split: ${s.percent.uses_ai}% say it used generative AI and ${s.percent.no_ai}% say it did not, from ${votes}${asOf}.`;
  }
  return opts.underReview ? `${out} These votes are under review.` : out;
}

/** Link to the catalogue page a title came from. */
export function sourceUrl(source: string, externalId: string | null): string | null {
  if (!externalId) return null;
  if (source === "tmdb") {
    const m = /^(movie|tv)\/(\d+)$/.exec(externalId);
    return m ? `https://www.themoviedb.org/${m[1]}/${m[2]}` : null;
  }
  if (source === "openlibrary" && /^OL\d+W$/.test(externalId)) return `https://openlibrary.org/works/${externalId}`;
  return null;
}
