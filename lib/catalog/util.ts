/** Small helpers shared by the catalogue clients. */
export function yearOf(date: unknown): number | null {
  if (typeof date === "number" && date >= 1800 && date <= 2100) return Math.trunc(date);
  if (typeof date !== "string") return null;
  const y = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) && y >= 1800 && y <= 2100 ? y : null;
}

export function clip(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Keep the first `n` distinct values, in order. */
export function firstDistinct<T>(items: Iterable<T>, n: number): T[] {
  const out: T[] = [];
  for (const x of items) {
    if (!out.includes(x)) out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
