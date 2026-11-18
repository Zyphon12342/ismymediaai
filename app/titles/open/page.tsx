import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { openCatalogueTitle, OpenTitleError } from "@/lib/data/catalogue-titles";
import { titlePath } from "@/lib/services/labels";
import { createClient } from "@/lib/supabase/server";
import { LookupDetailQuery } from "@/lib/validation/media";

export const metadata: Metadata = { title: "Opening title", robots: { index: false, follow: false } };

/**
 * /titles/open?source=tmdb&id=movie/123 sends you to that title's page,
 * creating the page first if nobody has opened it before. Search results for
 * titles not on the site yet link here.
 */
export default async function OpenTitlePage({ searchParams }: PageProps<"/titles/open">) {
  const raw = await searchParams;
  const q = LookupDetailQuery.safeParse({ source: raw.source, id: raw.id });
  if (!q.success) return <Problem message="That link is not a title we can open." />;

  let slug: string;
  try {
    slug = await openCatalogueTitle(await createClient(), q.data.source, q.data.id);
  } catch (err) {
    if (err instanceof OpenTitleError) return <Problem message={err.message} />;
    throw err;
  }
  redirect(titlePath(slug));
}

function Problem({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Could not open this title</h1>
      <Alert>{message}</Alert>
      <Link href="/" className="underline">
        Back to search
      </Link>
    </div>
  );
}
