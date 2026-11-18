import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { CommentThread, CommentView } from "@/lib/data/comments";
import { formatDate } from "@/lib/services/account";
import { AI_AREA_LABELS, canEditComment, commentAnchor } from "@/lib/services/comments";
import { profilePath, titlePath } from "@/lib/services/labels";
import type { CommentSort } from "@/lib/validation/comment";
import { CommentActions } from "./comment-actions";
import { CommentBody } from "./comment-body";
import { CommentForm } from "./comment-form";

export interface Viewer {
  id: string;
  verified: boolean;
  moderator: boolean;
}

function Comment({
  c,
  mediaId,
  slug,
  viewer,
  open,
  siteKey,
  needsTurnstile,
  isReply,
}: {
  c: CommentView;
  mediaId: string;
  slug: string;
  viewer: Viewer | null;
  open: boolean;
  siteKey?: string;
  needsTurnstile: boolean;
  isReply: boolean;
}) {
  const anchor = commentAnchor(c.id);
  const mine = viewer !== null && c.userId === viewer.id;
  const created = new Date(c.createdAt);
  return (
    <article id={anchor} aria-labelledby={`${anchor}-by`} className="scroll-mt-20 space-y-2">
      <header className="flex items-center gap-2 text-xs text-zinc-600">
        {c.author ? <Avatar path={c.author.avatarPath} handle={c.author.handle} displayName={c.author.displayName} size={24} /> : null}
        <span id={`${anchor}-by`} className="font-medium text-zinc-900">
          {c.deleted ? (
            "Deleted comment"
          ) : c.author ? (
            <Link href={profilePath(c.author.handle)} className="hover:underline">
              {c.author.displayName ?? c.author.handle}
            </Link>
          ) : (
            "Former member"
          )}
        </span>
        {c.author && !c.deleted && c.author.role !== "user" ? (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">Moderator</span>
        ) : null}
        <a href={`${titlePath(slug)}#${anchor}`} className="hover:underline" title="Link to this comment">
          <time dateTime={c.createdAt}>{formatDate(created)}</time>
        </a>
        {c.editedAt && !c.deleted ? <span>(edited)</span> : null}
        {c.status !== "published" ? <span className="text-amber-800">Hidden from others</span> : null}
      </header>
      {c.deleted ? (
        <p className="text-sm italic text-zinc-600">This comment was deleted.</p>
      ) : (
        <>
          <CommentBody text={c.body} />
          {c.evidenceUrl ? (
            <p className="text-sm">
              <span className="font-medium">Evidence: </span>
              <a href={c.evidenceUrl} rel="nofollow ugc noopener noreferrer" target="_blank" className="break-all underline">
                {c.evidenceUrl}
              </a>
            </p>
          ) : null}
          {c.aiAreas.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Where AI was used">
              {c.aiAreas.map((a) => (
                <li key={a} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-900">
                  {AI_AREA_LABELS[a]}
                </li>
              ))}
            </ul>
          ) : null}
          {viewer?.verified ? (
            <CommentActions
              mediaId={mediaId}
              comment={{ id: c.id, body: c.body, evidenceUrl: c.evidenceUrl, aiAreas: c.aiAreas, isReply }}
              canReply={open}
              canEdit={mine && open && canEditComment(created)}
              canDelete={mine || viewer.moderator}
              siteKey={siteKey}
              needsTurnstile={needsTurnstile}
            />
          ) : null}
        </>
      )}
    </article>
  );
}

/** The comments on a title, server-rendered so search engines read them. */
export function CommentSection({
  mediaId,
  slug,
  threads,
  total,
  sort,
  nextCursor,
  viewer,
  open,
  locked,
  siteKey,
  needsTurnstile,
}: {
  mediaId: string;
  slug: string;
  threads: CommentThread[];
  total: number;
  sort: CommentSort;
  nextCursor: string | null;
  viewer: Viewer | null;
  open: boolean;
  locked: boolean;
  siteKey?: string;
  needsTurnstile: boolean;
}) {
  const base = titlePath(slug);
  const sortLink = (s: CommentSort, label: string) =>
    sort === s ? (
      <span aria-current="true" className="font-semibold text-zinc-900">
        {label}
      </span>
    ) : (
      <Link href={s === "evidence" ? `${base}#comments` : `${base}?sort=${s}#comments`} className="text-zinc-700 hover:underline">
        {label}
      </Link>
    );
  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-20 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="comments-heading" className="text-lg font-semibold">
          Comments {total ? <span className="font-normal text-zinc-600">({total})</span> : null}
        </h2>
        {total > 1 ? (
          <p className="flex gap-3 text-sm">
            {sortLink("evidence", "Evidence first")}
            {sortLink("newest", "Newest")}
          </p>
        ) : null}
      </div>

      {locked ? (
        <p className="text-sm text-zinc-700">Comments are locked on this title.</p>
      ) : !viewer ? (
        <p className="text-sm text-zinc-700">
          <Link href={`/sign-in?next=${encodeURIComponent(`${base}#comments`)}`} className="font-medium underline">
            Sign in
          </Link>{" "}
          to comment. Claims that AI was used should link to evidence.
        </p>
      ) : !viewer.verified ? (
        <p className="text-sm text-zinc-700">Verify your email to comment. Check your inbox for the link.</p>
      ) : open ? (
        <div className="rounded-lg border border-zinc-200 p-4">
          <CommentForm mediaId={mediaId} siteKey={siteKey} needsTurnstile={needsTurnstile} />
        </div>
      ) : null}

      {threads.length ? (
        <ol className="space-y-6">
          {threads.map((t) => (
            <li key={t.id} className="space-y-4 border-t border-zinc-200 pt-4">
              <Comment c={t} mediaId={mediaId} slug={slug} viewer={viewer} open={open} siteKey={siteKey} needsTurnstile={needsTurnstile} isReply={false} />
              {t.replies.length ? (
                <ol className="ml-4 space-y-4 border-l-2 border-zinc-100 pl-4 sm:ml-8">
                  {t.replies.map((r) => (
                    <li key={r.id}>
                      <Comment c={r} mediaId={mediaId} slug={slug} viewer={viewer} open={open} siteKey={siteKey} needsTurnstile={needsTurnstile} isReply />
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-zinc-600">No comments yet.</p>
      )}

      {nextCursor ? (
        <Link
          href={`${base}?${sort === "newest" ? "sort=newest&" : ""}cursor=${nextCursor}#comments`}
          rel="nofollow"
          className="inline-block text-sm font-medium underline"
        >
          More comments
        </Link>
      ) : null}
    </section>
  );
}
