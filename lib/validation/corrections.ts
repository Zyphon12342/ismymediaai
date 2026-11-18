import { z } from "@/lib/validation/zod";
import { evidenceUrl, uuid } from "./common";

export const RELATIONSHIPS = ["rights_holder", "creator", "representative", "other"] as const;

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const text = (min: number, max: number, tooShort: string) =>
  z
    .string()
    .trim()
    .min(min, tooShort)
    .max(max, `Use at most ${max.toLocaleString("en")} characters.`)
    .refine((s) => !CONTROL.test(s.replace(/[\n\t]/g, "")), "Remove special characters.");

/** A correction request from anyone, signed in or not. */
export const CorrectionInput = z.strictObject({
  mediaId: uuid,
  name: text(1, 200, "Enter your name or your organisation's."),
  email: z.email("Enter a valid email address so we can reply.").max(254),
  relationship: z.enum(RELATIONSHIPS),
  message: text(10, 4000, "Tell us what is wrong in at least 10 characters."),
  evidenceUrl: z.union([z.literal("").transform(() => null), evidenceUrl]).nullable().optional(),
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;

/** A moderator closing a request. */
export const HandleCorrectionInput = z.strictObject({
  status: z.enum(["resolved", "declined"]),
  note: z
    .string()
    .trim()
    .max(1000, "Use at most 1,000 characters.")
    .transform((s) => s || null)
    .nullable()
    .optional(),
});
export type HandleCorrectionInput = z.infer<typeof HandleCorrectionInput>;
