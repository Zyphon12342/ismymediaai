import { NextResponse } from "next/server";
import { withHandler } from "@/lib/http/handler";
import { HttpError } from "@/lib/http/errors";
import { moderationError } from "@/lib/http/moderation-errors";
import { uuid } from "@/lib/validation/common";
import { HandleCorrectionInput } from "@/lib/validation/corrections";

/** Close a correction request as resolved or declined. Logged to mod_actions. */
export const POST = withHandler<typeof HandleCorrectionInput, { id: string }>(
  { auth: "moderator", schema: HandleCorrectionInput },
  async ({ db, body, params }) => {
    if (!uuid.safeParse(params.id).success) throw new HttpError("not_found", "Not found.");
    const { data, error } = await db.rpc("handle_correction", {
      p_id: params.id,
      p_status: body.status,
      p_note: body.note ?? undefined,
    });
    if (error) throw moderationError(error.code, error.message, "Too many actions. Wait a minute.");
    return NextResponse.json({ logId: data }, { status: 201 });
  },
);
