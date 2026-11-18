import "server-only";
import type { Database } from "@/lib/database.types";
import type { DbClient } from "@/lib/supabase/server";

type Enums = Database["public"]["Enums"];

export interface QueueReport {
  id: string;
  reason: Enums["report_reason"];
  note: string | null;
  createdAt: string;
  reporter: string | null;
}

export interface QueueItem {
  targetType: Enums["report_target"];
  targetId: string;
  reports: QueueReport[];
  /** What the target looks like now. Null when it no longer exists. */
  preview:
    | { kind: "comment"; body: string; status: Enums["content_status"]; author: string | null; mediaSlug: string; mediaTitle: string }
    | { kind: "media"; title: string; slug: string; status: Enums["content_status"]; commentsLocked: boolean }
    | { kind: "profile"; handle: string; displayName: string | null; bannedUntil: string | null; trustLevel: number }
    | null;
}

export interface PendingEntry {
  id: string;
  slug: string;
  title: string;
  kind: Enums["media_kind"];
  year: number | null;
  createdAt: string;
  createdBy: string | null;
}

/**
 * Open reports grouped by target, oldest first, plus manual entries waiting
 * for review. Row Level Security returns nothing unless the caller is a
 * moderator.
 */
export async function getModQueue(db: DbClient): Promise<{ items: QueueItem[]; pending: PendingEntry[] }> {
  const { data: reports, error } = await db
    .from("reports")
    .select("id, target_type, target_id, reason, note, created_at, reporter:profiles!reports_reporter_id_fkey(handle)")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  const groups = new Map<string, QueueItem>();
  for (const r of reports ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) ?? { targetType: r.target_type, targetId: r.target_id, reports: [], preview: null };
    g.reports.push({ id: r.id, reason: r.reason, note: r.note, createdAt: r.created_at, reporter: r.reporter?.handle ?? null });
    groups.set(key, g);
  }
  const items = [...groups.values()];
  const ids = (t: QueueItem["targetType"]) => items.filter((i) => i.targetType === t).map((i) => i.targetId);

  const [comments, media, profiles, pending] = await Promise.all([
    ids("comment").length
      ? db
          .from("comments")
          .select("id, body, status, author:profiles(handle), media!inner(slug, title)")
          .in("id", ids("comment"))
      : Promise.resolve({ data: [], error: null }),
    ids("media").length
      ? db.from("media").select("id, slug, title, status, comments_locked").in("id", ids("media"))
      : Promise.resolve({ data: [], error: null }),
    ids("profile").length
      ? db.rpc("mod_profile_cards", { p_ids: ids("profile") })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("media")
      .select("id, slug, title, kind, release_year, created_at, creator:profiles!media_created_by_fkey(handle)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
  ]);
  for (const res of [comments, media, profiles, pending]) if (res.error) throw res.error;

  for (const i of items) {
    if (i.targetType === "comment") {
      const c = (comments.data ?? []).find((x) => x.id === i.targetId);
      i.preview = c
        ? { kind: "comment", body: c.body, status: c.status, author: c.author?.handle ?? null, mediaSlug: c.media.slug, mediaTitle: c.media.title }
        : null;
    } else if (i.targetType === "media") {
      const m = (media.data ?? []).find((x) => x.id === i.targetId);
      i.preview = m ? { kind: "media", title: m.title, slug: m.slug, status: m.status, commentsLocked: m.comments_locked } : null;
    } else {
      const p = (profiles.data ?? []).find((x) => x.id === i.targetId);
      i.preview = p
        ? { kind: "profile", handle: p.handle, displayName: p.display_name, bannedUntil: p.banned_until, trustLevel: p.trust_level }
        : null;
    }
  }

  return {
    items,
    pending: (pending.data ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      kind: m.kind,
      year: m.release_year,
      createdAt: m.created_at,
      createdBy: m.creator?.handle ?? null,
    })),
  };
}
