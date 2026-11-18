import { NextResponse } from "next/server";
import { withHandler } from "@/lib/http/handler";
import { moderationError } from "@/lib/http/moderation-errors";
import { ReportInput } from "@/lib/validation/moderation";
import { track } from "@/lib/analytics/server";

/** Report a title, a comment or a profile. One open report per target. */
export const POST = withHandler<typeof ReportInput>({ auth: "verified", schema: ReportInput }, async ({ db, body, caller }) => {
  const { data, error } = await db
    .from("reports")
    .insert({ target_type: body.targetType, target_id: body.targetId, reason: body.reason, note: body.note ?? null })
    .select("id")
    .single();
  if (error) throw moderationError(error.code, error.message, "Too many reports today. Try again tomorrow.");
  track("report_filed", caller!.id, { target_type: body.targetType, reason: body.reason });
  return NextResponse.json({ id: data.id }, { status: 201 });
});
