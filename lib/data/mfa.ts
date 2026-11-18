import "server-only";
import type { DbClient } from "@/lib/supabase/server";

/** Whether the signed-in user has a confirmed authenticator app. */
export async function hasVerifiedFactor(db: DbClient): Promise<boolean> {
  const { data, error } = await db.auth.mfa.listFactors();
  if (error) return false;
  return data.totp.length > 0;
}
