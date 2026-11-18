import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CorrectionActions } from "@/components/moderation/correction-actions";
import { MergeTitle } from "@/components/moderation/merge-title";
import { ModActions } from "@/components/moderation/mod-actions";
import { getModQueue } from "@/lib/data/moderation";
import { getMyProfile } from "@/lib/data/profiles";
import { formatDate } from "@/lib/services/account";
import { KIND_LABELS, profilePath, titlePath } from "@/lib/services/labels";
import { QUEUE_REASON_LABELS } from "@/lib/services/moderation";
import { RELATIONSHIP_LABELS } from "@/lib/services/corrections";
import { hasVerifiedFactor } from "@/lib/data/mfa";
import { needsStepUp, stepUpPath } from "@/lib/services/mfa";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Moderator queue", robots: { index: false } };

const TARGET_LABELS = { comment: "Comment", media: "Title", profile: "Profile" } as const;

export default async function ModQueuePage() {
  const db = await createClient();
  const me = await getMyProfile(db);
  if (!me) redirect("/sign-in?next=/mod");
  if (me.role === "user" || !me.emailVerified) notFound();
  if (needsStepUp(me.role, me.aal)) redirect(stepUpPath(await hasVerifiedFactor(db), "/mod"));
  const { items, pending, corrections } = await getModQueue(db);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Moderator queue</h1>

      <section aria-labelledby="reports-heading" className="space-y-4">
        <h2 id="reports-heading" className="text-lg font-semibold">
          Open reports <span className="font-normal text-zinc-600">({items.length})</span>
        </h2>
        {items.length === 0 ? <p className="text-sm text-zinc-600">Nothing to review. Comments, titles and profiles show up here once someone reports them.</p> : null}
        <ol className="space-y-4">
          {items.map((i) => (
            <li key={`${i.targetType}:${i.targetId}`} className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                {TARGET_LABELS[i.targetType]} · {i.reports.length} {i.reports.length === 1 ? "report" : "reports"}
              </p>
              {i.preview?.kind === "comment" ? (
                <div className="space-y-1 text-sm">
                  <p className="whitespace-pre-wrap break-words text-zinc-800">{i.preview.body || "(deleted)"}</p>
                  <p className="text-xs text-zinc-600">
                    By {i.preview.author ? <Link href={profilePath(i.preview.author)} className="underline">@{i.preview.author}</Link> : "a former member"} on{" "}
                    <Link href={`${titlePath(i.preview.mediaSlug)}#comment-${i.targetId}`} className="underline">
                      {i.preview.mediaTitle}
                    </Link>{" "}
                    · {i.preview.status}
                  </p>
                </div>
              ) : i.preview?.kind === "media" ? (
                <p className="text-sm">
                  <Link href={titlePath(i.preview.slug)} className="font-medium underline">
                    {i.preview.title}
                  </Link>{" "}
                  <span className="text-zinc-600">· {i.preview.status}{i.preview.commentsLocked ? " · comments locked" : ""}</span>
                </p>
              ) : i.preview?.kind === "profile" ? (
                <p className="text-sm">
                  <Link href={profilePath(i.preview.handle)} className="font-medium underline">
                    @{i.preview.handle}
                  </Link>{" "}
                  <span className="text-zinc-600">
                    · trust {i.preview.trustLevel}
                    {i.preview.bannedUntil && new Date(i.preview.bannedUntil) > new Date() ? " · banned" : ""}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-zinc-600">This item no longer exists.</p>
              )}
              <ul className="space-y-1 text-xs text-zinc-700">
                {i.reports.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{QUEUE_REASON_LABELS[r.reason]}</span>
                    {r.note ? `: ${r.note}` : ""} · {r.reporter ? `@${r.reporter}` : r.reason === "vote_spike" ? "automatic check" : "former member"} · {formatDate(new Date(r.createdAt))}
                  </li>
                ))}
              </ul>
              <ModActions
                targetType={i.targetType}
                targetId={i.targetId}
                commentsLocked={i.preview?.kind === "media" ? i.preview.commentsLocked : undefined}
              />
              {i.preview?.kind === "media" && i.reports.some((r) => r.reason === "duplicate") ? (
                <MergeTitle fromId={i.targetId} title={i.preview.title} />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="corrections-heading" className="space-y-4">
        <h2 id="corrections-heading" className="text-lg font-semibold">
          Correction requests <span className="font-normal text-zinc-600">({corrections.length})</span>
        </h2>
        {corrections.length === 0 ? (
          <p className="text-sm text-zinc-600">None open. Rights holders and visitors send these from the &quot;Request a correction&quot; link on a title.</p>
        ) : null}
        <ol className="space-y-4">
          {corrections.map((c) => (
            <li key={c.id} className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <p className="text-sm">
                {c.media ? (
                  <Link href={titlePath(c.media.slug)} className="font-medium underline">
                    {c.media.title}
                  </Link>
                ) : (
                  "A removed title"
                )}{" "}
                <span className="text-zinc-600">· {formatDate(new Date(c.createdAt))}</span>
              </p>
              <p className="text-xs text-zinc-700">
                From {c.name} (<a href={`mailto:${c.email}`} className="underline">{c.email}</a>) · {RELATIONSHIP_LABELS[c.relationship]}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">{c.message}</p>
              {c.evidenceUrl ? (
                <p className="break-all text-xs">
                  Evidence:{" "}
                  <a href={c.evidenceUrl} rel="noopener noreferrer nofollow ugc" target="_blank" className="underline">
                    {c.evidenceUrl}
                  </a>
                </p>
              ) : null}
              <CorrectionActions id={c.id} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pending-heading" className="space-y-4">
        <h2 id="pending-heading" className="text-lg font-semibold">
          Titles waiting for review <span className="font-normal text-zinc-600">({pending.length})</span>
        </h2>
        {pending.length === 0 ? <p className="text-sm text-zinc-600">Nothing waiting.</p> : null}
        <ol className="space-y-4">
          {pending.map((m) => (
            <li key={m.id} className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <p className="text-sm">
                <Link href={titlePath(m.slug)} className="font-medium underline">
                  {m.title}
                  {m.year ? ` (${m.year})` : ""}
                </Link>{" "}
                <span className="text-zinc-600">
                  · {KIND_LABELS[m.kind]} · added by {m.createdBy ? `@${m.createdBy}` : "a former member"} on {formatDate(new Date(m.createdAt))}
                </span>
              </p>
              <ModActions targetType="media" targetId={m.id} actions={["restore", "remove"]} labels={{ restore: "Approve", remove: "Reject" }} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
