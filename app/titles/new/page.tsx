import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddTitleForm } from "@/components/media/add-title-form";
import { Alert, Card } from "@/components/ui";
import { listGenres } from "@/lib/data/media";
import { getMyProfile } from "@/lib/data/profiles";
import { publicEnv } from "@/lib/env";
import { TRUST_PROMOTION_HOURS } from "@/lib/services/trust";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add a title", robots: { index: false } };

export default async function NewTitlePage() {
  const db = await createClient();
  const me = await getMyProfile(db);
  if (!me) redirect("/sign-in?next=/titles/new");
  const allowed = me.role !== "user" || (me.emailVerified && me.trustLevel >= 1);
  const genres = allowed ? await listGenres(db) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a title</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Find it in TMDB (movies and TV) or Open Library (books). You can add up to 5 titles a day.
        </p>
      </div>
      {allowed ? (
        <Card>
          <AddTitleForm genres={genres} siteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </Card>
      ) : (
        <Alert tone="info">
          {me.emailVerified
            ? `New accounts can add titles ${TRUST_PROMOTION_HOURS} hours after signing up. Until then you can browse, and vote once titles are here.`
            : "Verify your email first, then you can add titles 72 hours after signing up."}{" "}
          <Link href="/" className="underline">
            Browse titles
          </Link>
        </Alert>
      )}
    </div>
  );
}
