import { KIND_LABELS } from "@/lib/services/labels";

type Kind = keyof typeof KIND_LABELS;

/** Poster or book cover from TMDB / Open Library, or a plain placeholder. */
export function Cover({ url, title, kind, className = "" }: { url: string | null; title: string; kind: Kind; className?: string }) {
  if (url) {
    // Catalogue images arrive pre-sized; Cloudflare image resizing is not used (cost).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Cover of ${title}`} loading="lazy" className={`aspect-[2/3] w-full rounded-md bg-zinc-100 object-cover ${className}`} />;
  }
  return (
    <div className={`flex aspect-[2/3] w-full items-center justify-center rounded-md bg-zinc-100 p-3 text-center text-xs text-zinc-700 ${className}`}>
      {KIND_LABELS[kind]}
    </div>
  );
}
