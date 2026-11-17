import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Defaults match the local Supabase CLI stack and `npm run preview`/`next start`.
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
export const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";

if (!/^(http:\/\/(127\.0\.0\.1|localhost))/.test(SUPABASE_URL)) {
  throw new Error("Integration tests only run against a local Supabase stack.");
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = () => createClient<Database>(SUPABASE_URL, SECRET_KEY, noSession);
export const anon = () => createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, noSession);

/** Create a confirmed user at the given trust level and return a client signed in as them. */
export async function signedInUser(handle: string, trustLevel = 1) {
  const email = `${handle}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: upd } = await a.from("profiles").update({ trust_level: trustLevel }).eq("id", data.user.id);
  if (upd) throw upd;
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

export async function publishedTitle(slug: string) {
  const { data, error } = await admin()
    .from("media")
    .insert({ kind: "movie", slug, title: slug, source: "tmdb", external_id: slug, status: "published" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
