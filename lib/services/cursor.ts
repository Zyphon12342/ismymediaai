/**
 * Keyset pagination cursors: an opaque token holding the sort timestamp and a
 * tie-breaking id of the last row on the previous page.
 */
export interface Cursor {
  at: string;
  id: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export function encodeCursor(c: Cursor): string {
  return toBase64Url(`${c.at}|${c.id}`);
}

/** Returns null for anything that is not a cursor this app made. */
export function decodeCursor(token: string | null | undefined): Cursor | null {
  if (!token || token.length > 200) return null;
  try {
    const [at, id, ...rest] = fromBase64Url(token).split("|");
    if (rest.length || !at || !id || !ISO.test(at) || !UUID.test(id)) return null;
    return { at, id };
  } catch {
    return null;
  }
}

/**
 * PostgREST `or` filter for "rows after this cursor" when sorting by
 * (timeColumn desc, idColumn desc). Values are validated by decodeCursor, so
 * they cannot inject filter syntax.
 */
export function afterCursorFilter(c: Cursor, timeColumn: string, idColumn: string): string {
  const at = `"${c.at}"`;
  return `${timeColumn}.lt.${at},and(${timeColumn}.eq.${at},${idColumn}.lt.${c.id})`;
}
