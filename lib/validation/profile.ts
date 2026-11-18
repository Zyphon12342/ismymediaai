import { z } from "@/lib/validation/zod";
import { handle } from "./common";

/** Keep in sync with private.handle_reserved() in the accounts migration. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "administrator", "api", "auth", "help", "ismymediaai", "me", "mod", "moderator",
  "moderators", "null", "root", "settings", "sign_in", "sign_out", "sign_up", "signin",
  "signout", "signup", "staff", "support", "system", "team", "undefined",
]);

/** Placeholder handles given to new accounts look like user_ + 12 hex characters. */
export const PLACEHOLDER_HANDLE = /^user_[0-9a-f]{12}$/;

export function isReservedHandle(h: string): boolean {
  return RESERVED_HANDLES.has(h) || PLACEHOLDER_HANDLE.test(h);
}

/** A username a person may pick: valid shape and not reserved. */
export const chosenHandle = handle.refine((h) => !isReservedHandle(h), "That username is reserved.");

const CONTROL = /[\u0000-\u001f\u007f]/;

export const displayName = z
  .string()
  .trim()
  .min(1, "Use at least 1 character.")
  .max(50, "Use at most 50 characters.")
  .refine((s) => !CONTROL.test(s), "Remove special characters.");

/** Avatar object paths: <user id>/<random>.<ext>, inside the user's own folder. */
export const AVATAR_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(webp|png|jpg)$/;

export const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.");

export const email = z.email("Enter a valid email address.").max(254);

export const SignUpInput = z.strictObject({
  email,
  password,
  handle: chosenHandle,
});
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z.strictObject({
  email,
  password: z.string().min(1, "Enter your password.").max(72),
});

/** PATCH /api/me. Omitted fields stay as they are; null clears. */
export const ProfileUpdate = z
  .strictObject({
    handle: chosenHandle.optional(),
    displayName: displayName.nullable().optional(),
    avatarPath: z.string().regex(AVATAR_PATH, "Invalid avatar.").nullable().optional(),
    showVotes: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;
