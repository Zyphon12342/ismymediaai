"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { LookupDetail, LookupResult, MediaKind } from "@/lib/catalog/types";
import { KIND_LABELS, titlePath } from "@/lib/services/labels";
import { ROLES_BY_KIND, roleLabel } from "@/lib/services/media";
import { trackBrowser } from "@/components/analytics/analytics";

interface Genre {
  slug: string;
  name: string;
  kinds: MediaKind[];
}

type Result = LookupResult & { existingSlug: string | null };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T; status: number } | { ok: false; message: string; status: number }> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) return { ok: false, message: body?.error?.message ?? "Something went wrong. Try again.", status: res.status };
  return { ok: true, data: body as T, status: res.status };
}

function GenrePicker({ genres, kind, value, onChange }: { genres: Genre[]; kind: MediaKind; value: string[]; onChange: (v: string[]) => void }) {
  const options = genres.filter((g) => g.kinds.includes(kind));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Genres (pick 1 to 3)</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((g) => {
          const on = value.includes(g.slug);
          return (
            <label key={g.slug} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={!on && value.length >= 3}
                onChange={() => onChange(on ? value.filter((x) => x !== g.slug) : [...value, g.slug])}
              />
              {g.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AddTitleForm({ genres, siteKey }: { genres: Genre[]; siteKey?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"catalogue" | "manual">("catalogue");
  const [kind, setKind] = useState<MediaKind>("movie");
  const [results, setResults] = useState<Result[] | null>(null);
  const [detail, setDetail] = useState<LookupDetail | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [credits, setCredits] = useState<{ name: string; role: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);

  function changeKind(k: MediaKind) {
    setKind(k);
    setResults(null);
    setDetail(null);
    setPicked([]);
    setCredits([]);
    setError(null);
  }

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    const r = await api<{ results: Result[] }>(`/api/lookup?${new URLSearchParams({ kind, q })}`);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setResults(r.data.results);
  }

  async function select(result: Result) {
    setBusy(true);
    setError(null);
    const r = await api<LookupDetail>(`/api/lookup/detail?${new URLSearchParams({ source: result.source, id: result.externalId })}`);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setDetail(r.data);
    setPicked(r.data.genres.filter((g) => genres.some((x) => x.slug === g && x.kinds.includes(kind))).slice(0, 3));
  }

  async function submit(body: unknown) {
    trackBrowser("entry_create_started", {});
    if (picked.length < 1) return setError("Pick at least 1 genre.");
    if (siteKey && !token) return setError("Complete the bot check first.");
    setBusy(true);
    setError(null);
    const r = await api<{ slug: string; status: string; existing: boolean }>("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-turnstile-token": token } : {}) },
      body: JSON.stringify(body),
    });
    setBusy(false);
    setReset((n) => n + 1);
    if (!r.ok) return setError(r.message);
    router.push(titlePath(r.data.slug));
  }

  function submitManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const year = String(f.get("year") ?? "").trim();
    void submit({
      source: "manual",
      kind,
      title: String(f.get("title") ?? "").trim(),
      year: year ? Number(year) : null,
      synopsis: String(f.get("synopsis") ?? "").trim() || null,
      genres: picked,
      credits: credits.filter((c) => c.name.trim()),
    });
  }

  const roles = ROLES_BY_KIND[kind];

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What are you adding?</legend>
        <div className="flex gap-2">
          {(["movie", "tv_show", "book"] as const).map((k) => (
            <label key={k} className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${kind === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => changeKind(k)} className="sr-only" />
              {KIND_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-4 border-b border-zinc-200 text-sm" role="tablist">
        {(["catalogue", "manual"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setPicked(detail?.genres.slice(0, 3) ?? []); }}
            className={`-mb-px border-b-2 px-1 pb-2 font-medium ${mode === m ? "border-zinc-900" : "border-transparent text-zinc-600"}`}>
            {m === "catalogue" ? `Search ${kind === "book" ? "Open Library" : "TMDB"}` : "Add manually"}
          </button>
        ))}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {mode === "catalogue" ? (
        <div className="space-y-6">
          <form onSubmit={search} role="search" className="flex gap-2">
            <label htmlFor="lookup-q" className="sr-only">Title to look up</label>
            <input id="lookup-q" name="q" type="search" maxLength={100} required placeholder={`Search ${KIND_LABELS[kind].toLowerCase()} titles`} className={inputClass} />
            <Button type="submit" disabled={busy}>Search</Button>
          </form>

          {results && !detail ? (
            results.length ? (
              <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
                {results.map((r) => (
                  <li key={r.externalId} className="flex items-center gap-3 p-3">
                    {r.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt="" className="h-16 w-11 rounded bg-zinc-100 object-cover" />
                    ) : (
                      <span className="h-16 w-11 rounded bg-zinc-100" />
                    )}
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{r.title}{r.year ? ` (${r.year})` : ""}</p>
                      {r.byline ? <p className="text-zinc-600">{r.byline}</p> : null}
                    </div>
                    {r.existingSlug ? (
                      <Link href={titlePath(r.existingSlug)} className="text-sm underline">Already here</Link>
                    ) : (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => select(r)} aria-label={`Select ${r.title}${r.year ? ` (${r.year})` : ""}`}>
                        Select
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600">No matches. Try another spelling, or add it manually.</p>
            )
          ) : null}

          {detail ? (
            <div className="space-y-4 rounded-md border border-zinc-200 p-4">
              <div className="flex gap-4">
                {detail.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.coverUrl} alt="" className="h-36 w-24 rounded bg-zinc-100 object-cover" />
                ) : null}
                <div className="space-y-1 text-sm">
                  <p className="text-base font-semibold">{detail.title}{detail.year ? ` (${detail.year})` : ""}</p>
                  {detail.synopsis ? <p className="line-clamp-4 text-zinc-700">{detail.synopsis}</p> : null}
                  {detail.credits.length ? (
                    <p className="text-zinc-600">
                      {detail.credits.slice(0, 6).map((c) => `${c.name} (${roleLabel(c.role, 1).toLowerCase()})`).join(", ")}
                      {detail.credits.length > 6 ? ` and ${detail.credits.length - 6} more` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
              <GenrePicker genres={genres} kind={kind} value={picked} onChange={setPicked} />
              <Turnstile siteKey={siteKey} action="add-title" onToken={setToken} resetSignal={reset} />
              <div className="flex gap-2">
                <Button type="button" disabled={busy} onClick={() => submit({ source: detail.source, externalId: detail.externalId, genres: picked })}>
                  {busy ? "Adding…" : "Add title"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDetail(null)}>Back to results</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submitManual} className="space-y-4">
          <p className="text-sm text-zinc-600">Manual entries are checked by a moderator before they appear.</p>
          <Field id="title" label="Title">
            <input id="title" name="title" required maxLength={300} className={inputClass} />
          </Field>
          <Field id="year" label="Year" hint="Optional.">
            <input id="year" name="year" type="number" min={1800} max={2100} className={`${inputClass} max-w-32`} aria-describedby="year-hint" />
          </Field>
          <Field id="synopsis" label="Short description" hint="Optional. Up to 5,000 characters.">
            <textarea id="synopsis" name="synopsis" rows={3} maxLength={5000} className={inputClass} aria-describedby="synopsis-hint" />
          </Field>
          <GenrePicker genres={genres} kind={kind} value={picked} onChange={setPicked} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Credits (optional)</legend>
            {credits.map((c, i) => (
              <div key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`credit-name-${i}`}>Name {i + 1}</label>
                <input id={`credit-name-${i}`} value={c.name} maxLength={300} placeholder="Name" className={inputClass}
                  onChange={(e) => setCredits(credits.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <label className="sr-only" htmlFor={`credit-role-${i}`}>Role {i + 1}</label>
                <select id={`credit-role-${i}`} value={c.role} className="rounded-md border border-zinc-300 px-2 text-sm"
                  onChange={(e) => setCredits(credits.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                  {roles.map((r) => <option key={r} value={r}>{roleLabel(r, 1)}</option>)}
                </select>
                <Button type="button" variant="ghost" onClick={() => setCredits(credits.filter((_, j) => j !== i))} aria-label={`Remove credit ${i + 1}`}>Remove</Button>
              </div>
            ))}
            {credits.length < 20 ? (
              <Button type="button" variant="secondary" onClick={() => setCredits([...credits, { name: "", role: roles[0]! }])}>Add a credit</Button>
            ) : null}
          </fieldset>
          <Turnstile siteKey={siteKey} action="add-title" onToken={setToken} resetSignal={reset} />
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for review"}</Button>
        </form>
      )}
    </div>
  );
}
