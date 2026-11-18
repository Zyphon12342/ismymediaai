import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { Cover } from "@/components/media/cover";
import { VoteBar } from "@/components/media/vote-bar";
import { VoteButtons } from "@/components/media/vote-buttons";
import { getMediaBySlug, getMyVote, slugById } from "@/lib/data/media";
import { getMyProfile } from "@/lib/data/profiles";
import { KIND_LABELS, titlePath } from "@/lib/services/labels";
import { groupCredits, roleLabel } from "@/lib/services/media";
import { sourceUrl, verdictSentence } from "@/lib/services/verdict";
import { createClient } from "@/lib/supabase/server";

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;
  const db = await createClient();
  return getMediaBySlug(db, slug);
});

function question(title: string, year: number | null) {
  return `Is ${title}${year ? ` (${year})` : ""} AI-generated?`;
}

export async function generateMetadata({ params }: PageProps<"/titles/[slug]">): Promise<Metadata> {
  const m = await load((await params).slug);
  if (!m) return { title: "Title not found" };
  const description = verdictSentence(m.tally, { updatedAt: m.tally.updatedAt ? new Date(m.tally.updatedAt) : null });
  return {
    title: { absolute: `${question(m.title, m.year)} Community verdict | isMyMediaAI` },
    description,
    alternates: { canonical: titlePath(m.slug) },
    robots: m.status === "published" ? undefined : { index: false },
    openGraph: { title: question(m.title, m.year), description, images: m.coverUrl ? [m.coverUrl] : undefined },
  };
}

export default async function TitlePage({ params }: PageProps<"/titles/[slug]">) {
  const m = await load((await params).slug);
  if (!m) notFound();
  if (m.mergedInto) {
    const target = await slugById(await createClient(), m.mergedInto);
    if (target) permanentRedirect(titlePath(target));
  }
  const db = await createClient();
  const me = await getMyProfile(db);
  const myVote = me ? await getMyVote(db, m.id, me.id) : null;
  const voteState = !me ? "signed_out" : !me.emailVerified ? "unverified" : me.trustLevel < 1 ? "new" : "ok";
  const src = sourceUrl(m.source, m.externalId);
  const groups = groupCredits(m.credits);

  return (
    <article className="space-y-8">
      {m.status !== "published" ? (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {m.status === "pending" ? "This title is waiting for a moderator to review it. Only you can see it for now." : "This title is hidden."}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
        <div className="w-40 sm:w-full">
          <Cover url={m.coverUrl} title={m.title} kind={m.kind} />
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-zinc-600">
              {KIND_LABELS[m.kind]}
              {m.year ? ` · ${m.year}` : ""}
              {m.originalTitle ? ` · ${m.originalTitle}` : ""}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{question(m.title, m.year)}</h1>
          </div>
          <p className="text-base text-zinc-800" data-testid="verdict">
            {verdictSentence(m.tally, {
              updatedAt: m.tally.updatedAt ? new Date(m.tally.updatedAt) : null,
              underReview: m.tally.underReview,
            })}
          </p>
          <VoteBar tally={m.tally} size="lg" showLegend />
          {m.status === "published" ? (
            <section aria-labelledby="vote-heading" className="space-y-2 rounded-lg border border-zinc-200 p-4">
              <h2 id="vote-heading" className="text-sm font-semibold">
                Did it use generative AI?
              </h2>
              <VoteButtons mediaId={m.id} slug={m.slug} initial={myVote} state={voteState} />
            </section>
          ) : null}
          {m.genres.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Genres">
              {m.genres.map((g) => (
                <li key={g.slug}>
                  <Link href={`/?kind=${m.kind}&genre=${g.slug}`} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-800 hover:bg-zinc-200">
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {m.synopsis ? <p className="max-w-prose text-sm text-zinc-700">{m.synopsis}</p> : null}
        </div>
      </div>

      {groups.length ? (
        <section aria-labelledby="credits-heading" className="space-y-3">
          <h2 id="credits-heading" className="text-lg font-semibold">
            Credits
          </h2>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.role}>
                <dt className="font-medium text-zinc-900">{roleLabel(g.role, g.items.length)}</dt>
                <dd className="text-zinc-700">
                  {g.items
                    .map((c) => (c.characterName ? `${c.contributor.name} (${c.characterName})` : c.contributor.name))
                    .join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <p className="text-xs text-zinc-500">
        {src ? (
          <>
            Details from{" "}
            <a href={src} rel="noopener noreferrer" target="_blank" className="underline">
              {m.source === "tmdb" ? "TMDB" : "Open Library"}
            </a>
            .
          </>
        ) : (
          "Details added by a member."
        )}
      </p>
    </article>
  );
}
