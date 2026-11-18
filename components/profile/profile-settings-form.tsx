"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { fieldErrors } from "@/components/auth/field-errors";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { avatarUrl, formatDate, initials } from "@/lib/services/account";
import {
  AVATAR_INPUT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  avatarExtension,
  avatarObjectPath,
  centreSquare,
} from "@/lib/services/image";
import { createClient } from "@/lib/supabase/browser";
import { ProfileUpdate } from "@/lib/validation/profile";

interface Props {
  userId: string;
  supabaseUrl: string;
  handle: string;
  displayName: string | null;
  avatarPath: string | null;
  showVotes: boolean;
  handleLockedUntil: string | null;
  placeholderHandle: boolean;
}

async function patchMe(body: unknown): Promise<string | null> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const err = (await res.json().catch(() => null)) as { error?: { message?: string; details?: { message?: string }[] } } | null;
  return err?.error?.details?.[0]?.message ?? err?.error?.message ?? "Could not save. Try again.";
}

/** Re-encode to a 256 px square WebP (PNG if the browser cannot), dropping EXIF and anything else in the file. */
async function toAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, size } = centreSquare(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("encode failed");
  return png;
}

export function ProfileSettingsForm(props: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatarPath, setAvatarPath] = useState(props.avatarPath);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const handleLocked = props.handleLockedUntil !== null;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const nextHandle = String(form.get("handle") ?? props.handle).trim().toLowerCase();
    const nextName = String(form.get("displayName") ?? "").trim();
    const raw: Record<string, unknown> = {};
    if (!handleLocked && nextHandle !== props.handle) raw.handle = nextHandle;
    if (nextName !== (props.displayName ?? "")) raw.displayName = nextName === "" ? null : nextName;
    if (Object.keys(raw).length === 0) {
      setMessage({ tone: "success", text: "Nothing to save." });
      return;
    }
    const parsed = ProfileUpdate.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const err = await patchMe(parsed.data);
    setBusy(false);
    if (err) {
      setMessage({ tone: "error", text: err });
      return;
    }
    setMessage({ tone: "success", text: "Saved." });
    router.refresh();
  }

  async function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage(null);
    if (!AVATAR_INPUT_TYPES.includes(file.type)) {
      setMessage({ tone: "error", text: "Use a JPEG, PNG, WebP, GIF or AVIF image." });
      return;
    }
    if (file.size > 10 * AVATAR_MAX_BYTES) {
      setMessage({ tone: "error", text: "That image is too large. Use one under 20 MB." });
      return;
    }
    setAvatarBusy(true);
    try {
      const blob = await toAvatarBlob(file);
      const ext = avatarExtension(blob.type);
      if (!ext || blob.size > AVATAR_MAX_BYTES) throw new Error("bad output");
      const path = avatarObjectPath(props.userId, ext, crypto.randomUUID());
      const storage = createClient().storage.from("avatars");
      const { error: upErr } = await storage.upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;
      const err = await patchMe({ avatarPath: path });
      if (err) {
        await storage.remove([path]);
        setMessage({ tone: "error", text: err });
      } else {
        setAvatarPath(path);
        setMessage({ tone: "success", text: "Avatar updated." });
        router.refresh();
      }
    } catch {
      setMessage({ tone: "error", text: "That image could not be used. Try another one." });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    const err = await patchMe({ avatarPath: null });
    setAvatarBusy(false);
    if (err) {
      setMessage({ tone: "error", text: err });
      return;
    }
    setAvatarPath(null);
    router.refresh();
  }

  const src = avatarUrl(props.supabaseUrl, avatarPath);

  return (
    <div className="space-y-6">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <section aria-labelledby="avatar-heading" className="flex items-center gap-4">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Your avatar" width={72} height={72} className="h-18 w-18 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="inline-flex h-18 w-18 items-center justify-center rounded-full bg-zinc-200 text-xl font-semibold text-zinc-700">
            {initials(props.displayName, props.handle)}
          </span>
        )}
        <div className="space-y-2">
          <h2 id="avatar-heading" className="text-sm font-medium">Avatar</h2>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={avatarBusy} onClick={() => fileInput.current?.click()}>
              {avatarBusy ? "Uploading…" : "Upload image"}
            </Button>
            {avatarPath ? (
              <Button type="button" variant="ghost" disabled={avatarBusy} onClick={removeAvatar}>
                Remove
              </Button>
            ) : null}
          </div>
          <input ref={fileInput} type="file" accept={AVATAR_INPUT_TYPES.join(",")} className="sr-only" aria-label="Avatar image" onChange={onAvatar} />
          <p className="text-xs text-zinc-600">Cropped to a square and resized to 256 px. Location data is removed.</p>
        </div>
      </section>

      <form onSubmit={onSave} noValidate className="space-y-4">
        <Field id="displayName" label="Display name" hint="Optional. Up to 50 characters." error={errors.displayName}>
          <input id="displayName" name="displayName" defaultValue={props.displayName ?? ""} maxLength={50} className={inputClass}
            aria-describedby={errors.displayName ? "displayName-error" : "displayName-hint"} />
        </Field>
        <Field
          id="handle"
          label="Username"
          error={errors.handle}
          hint={
            handleLocked
              ? `You changed your username recently. You can change it again on ${formatDate(new Date(props.handleLockedUntil!))}.`
              : props.placeholderHandle
                ? "Pick a username. After this, you can change it once every 30 days."
                : "You can change your username once every 30 days."
          }
        >
          <input id="handle" name="handle" defaultValue={props.handle} disabled={handleLocked} minLength={3} maxLength={30}
            autoComplete="username" className={inputClass} aria-describedby={errors.handle ? "handle-error" : "handle-hint"} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
