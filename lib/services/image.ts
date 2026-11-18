/** Square-crop and scale avatar images in the browser before upload. */
export const AVATAR_SIZE = 256;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** Centre square crop of a w×h image, as a source rectangle. */
export function centreSquare(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}

export function avatarExtension(mime: string): "webp" | "png" | "jpg" | null {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return null;
}

/** A random object name inside the user's own folder. */
export function avatarObjectPath(userId: string, ext: "webp" | "png" | "jpg", random: string): string {
  return `${userId}/${random.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)}.${ext}`;
}
