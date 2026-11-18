import Link from "next/link";
import type { MediaCard as Card } from "@/lib/data/media";
import { KIND_LABELS, titlePath } from "@/lib/services/labels";
import { Cover } from "./cover";
import { VoteBar } from "./vote-bar";

export function MediaCard({ media }: { media: Card }) {
  return (
    <li>
      <Link href={titlePath(media.slug)} className="group block space-y-2">
        <Cover url={media.coverUrl} title={media.title} kind={media.kind} className="group-hover:opacity-90" />
        <div>
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">{media.title}</p>
          <p className="text-xs text-zinc-600">
            {KIND_LABELS[media.kind]}
            {media.year ? ` · ${media.year}` : ""}
          </p>
        </div>
        <VoteBar tally={media.tally} />
        <p className="text-xs text-zinc-600">
          {media.total === 0 ? "No votes yet" : `${media.total} vote${media.total === 1 ? "" : "s"}`}
        </p>
      </Link>
    </li>
  );
}
