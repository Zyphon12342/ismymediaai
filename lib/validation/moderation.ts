import { z } from "zod";
import { uuid } from "./common";

export const reportTarget = z.enum(["media", "comment", "profile"]);
export const reportReason = z.enum(["spam", "harassment", "unsupported_claim", "duplicate", "wrong_details", "other"]);

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const note = z
  .string()
  .trim()
  .max(1000, "Use at most 1,000 characters.")
  .refine((s) => !CONTROL.test(s), "Remove special characters.")
  .transform((s) => s || null);

export const ReportInput = z.strictObject({
  targetType: reportTarget,
  targetId: uuid,
  reason: reportReason,
  note: note.nullable().optional(),
});
export type ReportInput = z.infer<typeof ReportInput>;

export const modAction = z.enum([
  "hide",
  "restore",
  "remove",
  "ban",
  "unban",
  "set_trust",
  "set_role",
  "lock_comments",
  "dismiss_report",
]);

export const ModActionInput = z.strictObject({
  action: modAction,
  targetType: reportTarget,
  targetId: uuid,
  reason: note.nullable().optional(),
  value: z.number().int().min(0).max(3650).nullable().optional(),
});
export type ModActionInput = z.infer<typeof ModActionInput>;
