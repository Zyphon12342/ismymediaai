import { publicEnv } from "@/lib/env";
import { avatarUrl, initials } from "@/lib/services/account";

/** Round avatar, or initials when the user has none. */
export function Avatar({
  path,
  handle,
  displayName,
  size = 40,
}: {
  path: string | null;
  handle: string;
  displayName: string | null;
  size?: number;
}) {
  const src = avatarUrl(publicEnv().NEXT_PUBLIC_SUPABASE_URL, path);
  const style = { width: size, height: size };
  if (src) {
    // Avatars are already 256 px WebP from the upload step; no resizing needed.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={style} className="rounded-full bg-zinc-100 object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.max(10, size / 2.6) }}
      className="inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700"
    >
      {initials(displayName, handle)}
    </span>
  );
}
