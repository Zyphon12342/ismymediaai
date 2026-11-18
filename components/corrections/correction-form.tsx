"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { CORRECTION_POLICY_PATH, RELATIONSHIP_LABELS } from "@/lib/services/corrections";
import { titlePath } from "@/lib/services/labels";
import { RELATIONSHIPS } from "@/lib/validation/corrections";

type Issue = { path?: (string | number)[]; message?: string };

/** The "Request a correction" form. Works signed in or out; replies go to the email given. */
export function CorrectionForm({ mediaId, slug, title, siteKey, defaultEmail }: { mediaId: string; slug: string; title: string; siteKey?: string; defaultEmail?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (siteKey && !token) return setError("Complete the bot check first.");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-turnstile-token": token } : {}) },
      body: JSON.stringify({
        mediaId,
        name: String(f.get("name") ?? ""),
        email: String(f.get("email") ?? "").trim(),
        relationship: String(f.get("relationship") ?? ""),
        message: String(f.get("message") ?? ""),
        evidenceUrl: String(f.get("evidenceUrl") ?? "").trim() || null,
      }),
    });
    setBusy(false);
    setReset((n) => n + 1);
    if (res.ok) return setSent(true);
    const data = (await res.json().catch(() => null)) as { error?: { message?: string; details?: Issue[] } } | null;
    const details = Array.isArray(data?.error?.details) ? data.error.details : [];
    const byField: Record<string, string> = {};
    for (const d of details) if (d.path?.[0] && d.message) byField[String(d.path[0])] ??= d.message;
    setFieldErrors(byField);
    setError(Object.keys(byField).length ? "Check the highlighted fields." : (data?.error?.message ?? "That did not work. Try again."));
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <Alert tone="success">Thanks. Your request is with our moderators, and we will reply to the email you gave.</Alert>
        <p className="text-sm">
          <Link href={titlePath(slug)} className="underline">
            Back to {title}
          </Link>
        </p>
      </div>
    );
  }

  const describe = (id: string) => (fieldErrors[id] ? `${id}-error` : undefined);

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="name" label="Your name or organisation" error={fieldErrors.name}>
        <input id="name" name="name" required maxLength={200} autoComplete="name" className={inputClass} aria-describedby={describe("name")} aria-invalid={!!fieldErrors.name} />
      </Field>
      <Field id="email" label="Email for our reply" hint="Only moderators see it. We use it to reply about this request and nothing else." error={fieldErrors.email}>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={defaultEmail} className={inputClass} aria-describedby={describe("email") ?? "email-hint"} aria-invalid={!!fieldErrors.email} />
      </Field>
      <Field id="relationship" label="Your connection to this title" error={fieldErrors.relationship}>
        <select id="relationship" name="relationship" required defaultValue="rights_holder" className={inputClass}>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {RELATIONSHIP_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="message" label="What is wrong, and what is right?" hint="For example: the verdict, a specific comment, or the credits. 10 to 4,000 characters." error={fieldErrors.message}>
        <textarea id="message" name="message" required minLength={10} maxLength={4000} rows={6} className={inputClass} aria-describedby={describe("message") ?? "message-hint"} aria-invalid={!!fieldErrors.message} />
      </Field>
      <Field id="evidenceUrl" label="Link to evidence (optional)" hint="An official statement, credits page or similar. https:// links only." error={fieldErrors.evidenceUrl}>
        <input id="evidenceUrl" name="evidenceUrl" type="url" maxLength={2000} placeholder="https://" className={inputClass} aria-describedby={describe("evidenceUrl") ?? "evidenceUrl-hint"} aria-invalid={!!fieldErrors.evidenceUrl} />
      </Field>
      <Turnstile siteKey={siteKey} action="correction" onToken={setToken} resetSignal={reset} />
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>
          Send request
        </Button>
        <Link href={CORRECTION_POLICY_PATH} className="text-sm underline">
          How we handle corrections
        </Link>
      </div>
    </form>
  );
}
