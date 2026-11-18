import { NextResponse } from "next/server";
import { withHandler } from "@/lib/http/handler";
import { HttpError, fromPostgresError } from "@/lib/http/errors";
import { CorrectionInput } from "@/lib/validation/corrections";

/** File a correction request. Open to everyone, behind Turnstile and per-email limits. */
export const POST = withHandler<typeof CorrectionInput>(
  { auth: "public", schema: CorrectionInput, turnstile: "correction" },
  async ({ db, body }) => {
    const { data, error } = await db.rpc("request_correction", {
      p_media: body.mediaId,
      p_name: body.name,
      p_email: body.email,
      p_relationship: body.relationship,
      p_message: body.message,
      p_evidence_url: body.evidenceUrl ?? undefined,
    });
    if (error) {
      if (error.code === "P0002") throw new HttpError("not_found", "That title is not available.");
      if (error.code === "RL429") throw new HttpError("rate_limited", "Too many requests today. Try again tomorrow, or email us.");
      throw fromPostgresError(error.code, "Check the form and try again.");
    }
    return NextResponse.json({ id: data }, { status: 201 });
  },
);
