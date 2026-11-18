import Link from "next/link";
import type { MediaCard as Card } from "@/lib/data/media";
import { KIND_LABELS, titlePath } from "@/lib/services/labels";
import { cardVoteLine } from "@/lib/services/verdict";
import { Cover } from "./cover";
import { VoteBar } from "./vote-bar";

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
