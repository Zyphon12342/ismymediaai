import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ShowVotesToggle } from "@/components/profile/show-votes-toggle";
import {
  canSeeVotes,
  getMyProfile,
  getProfileStats,
  getPublicProfile,
  listProfileComments,
  listProfileVotes,
} from "@/lib/data/profiles";
import { formatDate, memberSince } from "@/lib/services/account";
import { commentPermalink } from "@/lib/services/comments";
import { KIND_LABELS, VOTE_LABELS, titlePath } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";
import { handle as handleSchema } from "@/lib/validation/common";

async function load(raw: string) {
  const h = handleSchema.safeParse(decodeURIComponent(raw));
  if (!h.success) return null;
  const db = await createClient();
  const profile = await getPublicProfile(db, h.data);
  return profile ? { db, profile } : null;
}

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const found = await load((await params).handle);
  if (!found) return { title: "User not found" };
  const { profile } = found;
  const name = profile.displayName ?? profile.handle;
  return {
    title: `${name} (@${profile.handle})`,
    description: `${name}'s comments and evidence on isMyMediaAI.`,
    alternates: { canonical: `/u/${profile.handle}` },
  };
}

const VOTE_DOT = { uses_ai: "bg-vote-ai", no_ai: "bg-vote-no-ai", unsure: "bg-vote-unsure" } as const;

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[handle]">) {
  const found = await load((await params).handle);
  if (!found) notFound();
  const { db, profile } = found;
  const sp = await searchParams;
  const tab = sp.tab === "votes" ? "votes" : "comments";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;

  const [me, stats] = await Promise.all([getMyProfile(db), getProfileStats(db, profile.id)]);
  const isOwner = me?.id === profile.id;
  const votesVisible = canSeeVotes(profile, me?.id ?? null);
  const name = profile.displayName ?? profile.handle;

  const comments = tab === "comments" ? await listProfileComments(db, profile.id, { cursor }) : null;
  const votes = tab === "votes" && votesVisible ? await listProfileVotes(db, profile.id, { cursor }) : null;
  const nextCursor = comments?.nextCursor ?? votes?.nextCursor ?? null;

  const tabLink = (t: "comments" | "votes", label: string, count: number) => (
    <Link
      href={t === "comments" ? `/u/${profile.handle}` : `/u/${profile.handle}?tab=votes`}
      aria-current={tab === t ? "page" : undefined}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-600 hover:text-zinc-900"}`}
    >
      {label} <span className="text-zinc-500">{count}</span>
    </Link>
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar path={profile.avatarPath} handle={profile.handle} displayName={profile.displayName} size={88} />
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-zinc-600">
            @{profile.handle}
            {profile.role !== "user" ? (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium capitalize text-zinc-700">
                {profile.role}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-zinc-600">Member since {memberSince(new Date(profile.createdAt))}</p>
          <dl className="flex gap-6 pt-2 text-sm">
            <div>
              <dt className="text-zinc-600">Votes</dt>
              <dd className="font-semibold">{stats.votes}</dd>
            </div>
            <div>
              <dt className="text-zinc-600">Comments</dt>
              <dd className="font-semibold">{stats.comments}</dd>
            </div>
            <div>
              <dt className="text-zinc-600">Titles added</dt>
              <dd className="font-semibold">{stats.titlesAdded}</dd>
            </div>
          </dl>
        </div>
        {isOwner ? (
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Link href="/settings/profile" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">
              Edit profile
            </Link>
            <ShowVotesToggle initial={profile.showVotes} />
          </div>
        ) : null}
      </section>

      <nav className="flex gap-6 border-b border-zinc-200" aria-label="Profile sections">
        {tabLink("comments", "Comments", stats.comments)}
        {tabLink("votes", "Votes", stats.votes)}
      </nav>

      {comments ? (
        comments.items.length ? (
          <ul className="divide-y divide-zinc-200">
            {comments.items.map((c) => (
              <li key={c.id} className="space-y-1 py-4">
                <p className="text-sm text-zinc-600">
                  On <Link href={commentPermalink(c.media.slug, c.id)} className="font-medium text-zinc-900 underline">{c.media.title}</Link>{" "}
                  <span className="text-zinc-500">({KIND_LABELS[c.media.kind]}) · {formatDate(new Date(c.createdAt))}</span>
                </p>
                <p className="whitespace-pre-line break-words text-sm text-zinc-900">{c.body}</p>
                {c.evidenceUrl ? (
                  <a href={c.evidenceUrl} rel="nofollow ugc noopener noreferrer" target="_blank" className="break-all text-sm text-blue-700 underline">
                    {c.evidenceUrl}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">{isOwner ? "You have not commented yet." : `${name} has not commented yet.`}</p>
        )
      ) : null}

      {tab === "votes" && !votesVisible ? (
        <p className="text-sm text-zinc-600">{name} keeps their votes private.</p>
      ) : null}
      {votes ? (
        <>
          {isOwner && !profile.showVotes ? (
            <p className="text-sm text-zinc-600">Only you can see this list. Turn on Show my votes to share it.</p>
          ) : null}
          {votes.items.length ? (
            <ul className="divide-y divide-zinc-200">
              {votes.items.map((v) => (
                <li key={v.media.slug} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <Link href={titlePath(v.media.slug)} className="font-medium underline">
                    {v.media.title} <span className="font-normal text-zinc-500">({KIND_LABELS[v.media.kind]})</span>
                  </Link>
                  <span className="inline-flex items-center gap-2 text-zinc-800">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${VOTE_DOT[v.value]}`} />
                    {VOTE_LABELS[v.value]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600">No votes yet.</p>
          )}
        </>
      ) : null}

      {nextCursor ? (
        <Link
          href={`/u/${profile.handle}?${new URLSearchParams({ ...(tab === "votes" ? { tab } : {}), cursor: nextCursor })}`}
          className="inline-block text-sm font-medium underline"
        >
          Older
        </Link>
      ) : null}
    </div>
  );
}
