import Link from "next/link";
import { catalogueHref, type CatalogueCard } from "@/lib/services/catalogue";
import type { MediaCard as Card } from "@/lib/data/media";
import { KIND_LABELS, titlePath } from "@/lib/services/labels";
import { cardVoteLine } from "@/lib/services/verdict";
import { Cover } from "./cover";
import { VoteBar } from "./vote-bar";

const EMPTY_TALLY = { uses_ai: 0, no_ai: 0, unsure: 0 };

export function MediaCard({ media, badge }: { media: Card; badge?: string }) {
  return (
    <li>
      <Link href={titlePath(media.slug)} className="group block space-y-2">
        <div className="relative">
          <Cover url={media.coverUrl} title={media.title} kind={media.kind} className="group-hover:opacity-90" />
          {badge ? (
            <span className="absolute left-2 top-2 rounded-full bg-zinc-900/85 px-2 py-0.5 text-xs font-medium text-white">{badge}</span>
          ) : null}
        </div>
        <div>
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">{media.title}</p>
          <p className="text-xs text-zinc-600">
            {KIND_LABELS[media.kind]}
            {media.year ? ` · ${media.year}` : ""}
          </p>
        </div>
        <VoteBar tally={media.tally} />
        <p className="text-xs text-zinc-600">{cardVoteLine(media.tally)}</p>
      </Link>
    </li>
  );
}

/**
 * A search result from TMDB, Open Library or AniList, shown in the same grid
 * as the site's own titles. Links to its page, which is created on first open.
 * nofollow: crawlers should not create pages by walking search results.
 */
export function CatalogueMediaCard({ media }: { media: CatalogueCard }) {
  return (
    <li>
      <Link href={catalogueHref(media)} prefetch={false} rel="nofollow" className="group block space-y-2">
        <Cover url={media.coverUrl} title={media.title} kind={media.kind} className="group-hover:opacity-90" />
        <div>
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">{media.title}</p>
          <p className="text-xs text-zinc-600">
            {KIND_LABELS[media.kind]}
            {media.year ? ` · ${media.year}` : ""}
          </p>
        </div>
        <VoteBar tally={EMPTY_TALLY} />
        <p className="text-xs text-zinc-600">{cardVoteLine(EMPTY_TALLY)}</p>
      </Link>
    </li>
  );
}
