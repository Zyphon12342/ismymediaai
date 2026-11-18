import "server-only";
import type { Database } from "@/lib/database.types";
import { decodeOffset, nextOffset } from "@/lib/services/media";
import type { DbClient } from "@/lib/supabase/server";
import type { CommentSort } from "@/lib/validation/comment";

type AiArea = Database["public"]["Enums"]["ai_area"];

export interface CommentAuthor {
  handle: string;
  displayName: string | null;
  avatarPath: string | null;
  role: Database["public"]["Enums"]["user_role"];
}

export interface CommentView {
  id: string;
  parentId: string | null;
  userId: string | null;
  author: CommentAuthor | null;
  body: string;
  evidenceUrl: string | null;
  aiAreas: AiArea[];
  status: Database["public"]["Enums"]["content_status"];
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}

export interface CommentThread extends CommentView {
  replies: CommentView[];
}

const COLUMNS = `
  id, parent_id, user_id, body, evidence_url, ai_areas, status, created_at, edited_at, deleted_at,
  author:profiles(handle, display_name, avatar_path, role)
` as const;

type Row = {
  id: string;
  parent_id: string | null;
  user_id: string | null;
  body: string;
  evidence_url: string | null;
  ai_areas: AiArea[];
  status: CommentView["status"];
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: { handle: string; display_name: string | null; avatar_path: string | null; role: CommentAuthor["role"] } | null;
};

function toView(r: Row): CommentView {
  return {
    id: r.id,
    parentId: r.parent_id,
    userId: r.user_id,
    author: r.author
      ? { handle: r.author.handle, displayName: r.author.display_name, avatarPath: r.author.avatar_path, role: r.author.role }
      : null,
    body: r.body,
    evidenceUrl: r.evidence_url,
    aiAreas: r.ai_areas,
    status: r.status,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deleted: r.deleted_at !== null,
  };
}

/**
 * Top-level comments on a title with their replies. "evidence" puts comments
 * with an evidence link first, then newest. Deleted comments are kept only
 * when they have replies, so a thread keeps its shape.
 */
export async function listComments(
  db: DbClient,
  mediaId: string,
  opts: { sort?: CommentSort; cursor?: string; limit?: number } = {},
): Promise<{ items: CommentThread[]; nextCursor: string | null; total: number }> {
  const limit = opts.limit ?? 20;
  const offset = decodeOffset(opts.cursor);
  let q = db
    .from("comments")
    .select(COLUMNS, { count: "exact" })
    .eq("media_id", mediaId)
    .is("parent_id", null);
  if (opts.sort !== "newest") q = q.order("evidence_url", { ascending: true, nullsFirst: false });
  q = q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + limit);
  const { data, error, count } = await q.overrideTypes<Row[], { merge: false }>();
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, limit);

  const replies = new Map<string, CommentView[]>();
  if (page.length) {
    const { data: rs, error: re } = await db
      .from("comments")
      .select(COLUMNS)
      .in("parent_id", page.map((r) => r.id))
      .order("created_at", { ascending: true })
      .limit(500)
      .overrideTypes<Row[], { merge: false }>();
    if (re) throw re;
    for (const r of rs ?? []) {
      const list = replies.get(r.parent_id!) ?? [];
      list.push(toView(r));
      replies.set(r.parent_id!, list);
    }
  }

  const items = page
    .map((r) => ({ ...toView(r), replies: (replies.get(r.id) ?? []).filter((x) => !x.deleted) }))
    .filter((t) => !t.deleted || t.replies.length > 0);
  return { items, nextCursor: nextOffset(offset, rows.length, limit), total: count ?? 0 };
}

export async function getComment(db: DbClient, id: string): Promise<(CommentView & { mediaId: string }) | null> {
  const { data, error } = await db
    .from("comments")
    .select(`media_id, ${COLUMNS}`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<(Row & { media_id: string }) | null, { merge: false }>();
  if (error) throw error;
  return data ? { ...toView(data), mediaId: data.media_id } : null;
}

export async function myCommentCount(db: DbClient): Promise<number> {
  const { data, error } = await db.rpc("my_comment_count");
  if (error) throw error;
  return data ?? 0;
}
