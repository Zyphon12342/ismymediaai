import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { browserOrigin, isSameOrigin } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";

/** POST only, same-origin only: ends this session and revokes its refresh token. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin("POST", request.headers, publicEnv().NEXT_PUBLIC_SITE_URL, request.url)) {
    return NextResponse.json({ error: { code: "forbidden", message: "Cross-site request blocked." } }, { status: 403 });
  }
  const db = await createClient();
  await db.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", browserOrigin(request.headers, request.url)), 303);
}
