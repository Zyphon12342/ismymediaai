import { z } from "zod";
import { aiArea, evidenceUrl, uuid } from "./common";

/** Control characters other than tab and newline. */
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

export const commentBody = z
  .string()
  .transform((s) => s.replace(/\r\n?/g, "\n").trim())
  .pipe(
    z
      .string()
      .min(1, "Write something first.")
      .max(2000, "Use at most 2,000 characters.")
      .refine((s) => !CONTROL.test(s), "Remove special characters."),
  );

export const aiAreas = z
  .array(aiArea)
  .max(8)
  .transform((a) => [...new Set(a)]);

export const CommentInput = z.strictObject({
  body: commentBody,
  evidenceUrl: z.union([evidenceUrl, z.literal("").transform(() => null), z.null()]).optional(),
  aiAreas: aiAreas.optional(),
  parentId: uuid.optional(),
});
export type CommentInput = z.infer<typeof CommentInput>;

/** PATCH /api/comments/{id}. Omitted fields stay as they are. */
export const CommentUpdate = z
  .strictObject({
    body: commentBody.optional(),
    evidenceUrl: z.union([evidenceUrl, z.literal("").transform(() => null), z.null()]).optional(),
    aiAreas: aiAreas.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");
export type CommentUpdate = z.infer<typeof CommentUpdate>;

export const commentSort = z.enum(["evidence", "newest"]);
export type CommentSort = z.infer<typeof commentSort>;

export const CommentListQuery = z.object({
  sort: commentSort.catch("evidence"),
  cursor: z.string().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
