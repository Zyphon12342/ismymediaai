import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import { afterCursorFilter, decodeCursor, encodeCursor } from "@/lib/services/cursor";
import type { Database } from "@/lib/database.types";

type MediaKind = Database["public"]["Enums"]["media_kind"];
type VoteValue = Database["public"]["Enums"]["vote_value"];

export interface MyProfile {
  id: string;
  handle: string;
  displayName: string | null;
  avatarPath: string | null;
  role: Database["public"]["Enums"]["user_role"];
  trustLevel: number;
  showVotes: boolean;
  bannedUntil: string | null;
  emailVerified: boolean;
  createdAt: string;
  handleChangedAt: string | null;
}

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string | null;
  avatarPath: string | null;
  role: Database["public"]["Enums"]["user_role"];
  showVotes: boolean;
  createdAt: string;
}

export interface ProfileStats {
  comments: number;
  votes: number;
  titlesAdded: number;
}

export interface MediaRef {
  slug: string;
  title: string;
  kind: MediaKind;
}

export interface ProfileComment {
  id: string;
  body: string;
  evidenceUrl: string | null;
  createdAt: string;
  media: MediaRef;
}

export interface ProfileVote {
  value: VoteValue;
  updatedAt: string;
  media: MediaRef;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** The signed-in user's own profile, or null when signed out. */
export async function getMyProfile(db: DbClient): Promise<MyProfile | null> {
  const { data: claims } = await db.auth.getClaims();
  if (!claims?.claims.sub) return null;
  const { data, error } = await db.rpc("my_profile").maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    handle: data.handle,
    displayName: data.display_name ?? null,
    avatarPath: data.avatar_path ?? null,
    role: data.role,
    trustLevel: data.trust_level,
    showVotes: data.show_votes,
    bannedUntil: data.banned_until ?? null,
    emailVerified: data.email_verified,
    createdAt: data.created_at,
    handleChangedAt: data.handle_changed_at ?? null,
  };
}

const PUBLIC_COLUMNS = "id, handle, display_name, avatar_path, role, show_votes, created_at" as const;

export async function getPublicProfile(db: DbClient, handle: string): Promise<PublicProfile | null> {
  const { data, error } = await db.from("profiles").select(PUBLIC_COLUMNS).eq("handle", handle).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    handle: data.handle,
    displayName: data.display_name,
    avatarPath: data.avatar_path,
    role: data.role,
    showVotes: data.show_votes,
    createdAt: data.created_at,
  };
}

export async function getProfileStats(db: DbClient, userId: string): Promise<ProfileStats> {
  const { data, error } = await db.rpc("profile_stats", { p_user: userId }).single();
  if (error) throw error;
  return { comments: data.comment_count, votes: data.vote_count, titlesAdded: data.titles_added };
}

/** Visible comments by a user, newest first. */
export async function listProfileComments(
  db: DbClient,
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<Page<ProfileComment>> {
  const limit = opts.limit ?? 20;
  let q = db
    .from("comments")
    .select("id, body, evidence_url, created_at, media!inner(slug, title, kind, status)")
    .eq("user_id", userId)
    .eq("status", "published")
    .is("deleted_at", null)
    .eq("media.status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  const cursor = decodeCursor(opts.cursor);
  if (cursor) q = q.or(afterCursorFilter(cursor, "created_at", "id"));
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id,
      body: r.body,
      evidenceUrl: r.evidence_url,
      createdAt: r.created_at,
      media: { slug: r.media.slug, title: r.media.title, kind: r.media.kind },
    })),
    nextCursor: rows.length > limit && last ? encodeCursor({ at: last.created_at, id: last.id }) : null,
  };
}

/**
 * A user's votes, most recently changed first. Row Level Security returns
 * nothing unless the caller is that user or the user has show_votes on.
 */
export async function listProfileVotes(
  db: DbClient,
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<Page<ProfileVote>> {
  const limit = opts.limit ?? 20;
  let q = db
    .from("votes")
    .select("media_id, value, updated_at, media!inner(slug, title, kind, status)")
    .eq("user_id", userId)
    .eq("media.status", "published")
    .order("updated_at", { ascending: false })
    .order("media_id", { ascending: false })
    .limit(limit + 1);
  const cursor = decodeCursor(opts.cursor);
  if (cursor) q = q.or(afterCursorFilter(cursor, "updated_at", "media_id"));
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      value: r.value,
      updatedAt: r.updated_at,
      media: { slug: r.media.slug, title: r.media.title, kind: r.media.kind },
    })),
    nextCursor: rows.length > limit && last ? encodeCursor({ at: last.updated_at, id: last.media_id }) : null,
  };
}

/** Whether `viewer` may see `profile`'s individual votes. */
export function canSeeVotes(profile: Pick<PublicProfile, "id" | "showVotes">, viewerId: string | null): boolean {
  return profile.showVotes || profile.id === viewerId;
}
