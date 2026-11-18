import { NextResponse } from "next/server";
import { withHandler } from "@/lib/http/handler";
import { moderationError } from "@/lib/http/moderation-errors";
import { ModActionInput } from "@/lib/validation/moderation";

/** Hide, restore, ban, set trust and the rest. Always writes mod_actions. */
export const POST = withHandler<typeof ModActionInput>({ auth: "moderator", schema: ModActionInput }, async ({ db, body }) => {
  const { data, error } = await db.rpc("moderate", {
    p_action: body.action,
    p_target_type: body.targetType,
    p_target: body.targetId,
    p_reason: body.reason ?? undefined,
    p_value: body.value ?? undefined,
  });
  if (error) throw moderationError(error.code, error.message, "Too many actions. Wait a minute.");
  return NextResponse.json({ logId: data }, { status: 201 });
});
