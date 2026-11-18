import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CorrectionForm } from "@/components/corrections/correction-form";
import { getMediaBySlug, slugById } from "@/lib/data/media";
import { publicEnv } from "@/lib/env";
import { CORRECTION_POLICY_PATH, correctionPath } from "@/lib/services/corrections";
import { titlePath } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Request a correction", robots: { index: false } };

export default async function CorrectionPage({ params }: PageProps<"/titles/[slug]/correction">) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) notFound();
  const db = await createClient();
  const m = await getMediaBySlug(db, slug);
  if (!m || m.status !== "published") notFound();
  if (m.mergedInto) {
    const target = await slugById(db, m.mergedInto);
    if (target) permanentRedirect(correctionPath(target));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm">
          <Link href={titlePath(m.slug)} className="underline">
            {m.title}
            {m.year ? ` (${m.year})` : ""}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Request a correction</h1>
        <p className="text-sm text-zinc-700">
          Are you the rights holder, a creator, or someone who knows this title is described wrongly? Tell us what is wrong and
          a moderator will review it and reply by email. Verdicts come from members&apos; votes, so we do not change them on
          request, but we do act on vote manipulation, false claims in comments and wrong details.{" "}
          <Link href={CORRECTION_POLICY_PATH} className="underline">
            Read the correction policy
          </Link>
          .
        </p>
      </div>
      <CorrectionForm mediaId={m.id} slug={m.slug} title={m.title} siteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
    </div>
  );
}
