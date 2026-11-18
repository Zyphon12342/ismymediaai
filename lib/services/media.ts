import type { CreditInput, LookupDetail, MediaKind } from "@/lib/catalog/types";
import type { CreateMediaInput } from "@/lib/validation/media";
import { isCompanyRole } from "@/lib/validation/media";
import { slugify } from "./slug";

/** Mirrors private.credit_role_allowed() so forms only offer roles that fit. */
export const ROLES_BY_KIND: Record<MediaKind, readonly string[]> = {
  movie: ["actor", "director", "writer", "composer", "studio"],
  tv_show: ["actor", "director", "creator", "writer", "showrunner", "composer", "studio", "network"],
  book: ["author", "illustrator", "translator", "publisher"],
};

export function roleAllowed(kind: MediaKind, role: string): boolean {
  return ROLES_BY_KIND[kind].includes(role);
}

export interface CreateMediaPayload {
  kind: MediaKind;
  source: "tmdb" | "openlibrary" | "manual";
  external_id: string | null;
  slug: string;
  title: string;
  original_title: string | null;
  release_year: number | null;
  synopsis: string | null;
  cover_url: string | null;
  genres: string[];
  credits: {
    name: string;
    kind: "person" | "company";
    role: string;
    external_id: string | null;
    character_name: string | null;
    billing_order: number | null;
  }[];
}

function credit(c: CreditInput): CreateMediaPayload["credits"][number] {
  return {
    name: c.name,
    kind: c.kind,
    role: c.role,
    external_id: c.externalId ?? null,
    character_name: c.role === "actor" ? (c.characterName ?? null) : null,
    billing_order: c.billingOrder ?? null,
  };
}

/** The argument for public.create_media() from a catalogue lookup. */
export function payloadFromCatalogue(detail: LookupDetail, genres: string[]): CreateMediaPayload {
  return {
    kind: detail.kind,
    source: detail.source,
    external_id: detail.externalId,
    slug: slugify(detail.title, detail.year),
    title: detail.title,
    original_title: detail.originalTitle,
    release_year: detail.year,
    synopsis: detail.synopsis,
    cover_url: detail.coverUrl,
    genres,
    credits: detail.credits.filter((c) => roleAllowed(detail.kind, c.role)).map(credit),
  };
}

/** The argument for public.create_media() from the manual form. */
export function payloadFromManual(input: Extract<CreateMediaInput, { source: "manual" }>): CreateMediaPayload {
  return {
    kind: input.kind,
    source: "manual",
    external_id: null,
    slug: slugify(input.title, input.year ?? null),
    title: input.title,
    original_title: null,
    release_year: input.year ?? null,
    synopsis: input.synopsis || null,
    cover_url: null,
    genres: input.genres,
    credits: input.credits
      .filter((c) => roleAllowed(input.kind, c.role))
      .map((c) => credit({ name: c.name, role: c.role as CreditInput["role"], kind: isCompanyRole(c.role) ? "company" : "person" })),
  };
}

/** Browse pages use offset cursors: sorts by score have no stable keyset. */
export const BROWSE_PAGE = 24;
export const MAX_OFFSET = 2000;

export function decodeOffset(cursor: string | undefined): number {
  if (!cursor || !/^\d{1,4}$/.test(cursor)) return 0;
  return Math.min(Number(cursor), MAX_OFFSET);
}

export function nextOffset(offset: number, got: number, pageSize = BROWSE_PAGE): string | null {
  const next = offset + pageSize;
  return got > pageSize && next <= MAX_OFFSET ? String(next) : null;
}

/** Group credits for display: people by role, then companies. */
export function groupCredits<T extends { role: string }>(credits: T[]): { role: string; items: T[] }[] {
  const order = ["creator", "showrunner", "director", "author", "writer", "illustrator", "translator", "composer", "actor", "studio", "network", "publisher"];
  const groups = new Map<string, T[]>();
  for (const c of credits) groups.set(c.role, [...(groups.get(c.role) ?? []), c]);
  return order.filter((r) => groups.has(r)).map((role) => ({ role, items: groups.get(role)! }));
}

export const ROLE_LABELS: Record<string, [string, string]> = {
  actor: ["Cast", "Cast"], director: ["Director", "Directors"], creator: ["Creator", "Creators"],
  writer: ["Writer", "Writers"], showrunner: ["Showrunner", "Showrunners"], composer: ["Music", "Music"],
  author: ["Author", "Authors"], illustrator: ["Illustrator", "Illustrators"], translator: ["Translator", "Translators"],
  studio: ["Studio", "Studios"], network: ["Network", "Networks"], publisher: ["Publisher", "Publishers"],
};

export function roleLabel(role: string, count: number): string {
  const l = ROLE_LABELS[role];
  return l ? l[count === 1 ? 0 : 1] : role;
}
