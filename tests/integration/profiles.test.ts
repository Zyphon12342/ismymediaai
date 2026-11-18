import { describe, expect, it } from "vitest";
import { APP_URL, SUPABASE_URL, admin, anon, namedUser, publishedTitle } from "./env";

const json = (cookie: string | null, body: unknown, origin = APP_URL) => ({
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Origin: origin,
    ...(cookie ? { Cookie: cookie } : {}),
  },
  body: JSON.stringify(body),
});

describe("public profile API", () => {
  it("returns the card and counts, and 404 for unknown users", async () => {
    const u = await namedUser("pub");
    const res = await fetch(`${APP_URL}/api/users/${u.handle}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { handle: string; stats: { votes: number }; trust_level?: number };
    expect(body.handle).toBe(u.handle);
    expect(body.stats).toEqual({ comments: 0, votes: 0, titlesAdded: 0 });
    expect(body).not.toHaveProperty("trustLevel");

    expect((await fetch(`${APP_URL}/api/users/nobody_here_${Date.now()}`)).status).toBe(404);
    expect((await fetch(`${APP_URL}/api/users/Bad%20Handle`)).status).toBe(404);
  });

  it("keeps votes private until show_votes is on", async () => {
    const u = await namedUser("voter");
    const mediaId = await publishedTitle(`it-prof-${crypto.randomUUID().slice(0, 8)}`);
    expect((await u.client.from("votes").insert({ media_id: mediaId, value: "uses_ai" })).error).toBeNull();

    expect((await fetch(`${APP_URL}/api/users/${u.handle}/votes`)).status).toBe(404);
    const own = await fetch(`${APP_URL}/api/users/${u.handle}/votes`, { headers: { Cookie: u.cookie } });
    expect(own.status).toBe(200);
    expect(((await own.json()) as { items: unknown[] }).items).toHaveLength(1);

    // Row Level Security agrees, even through the Data API directly.
    const { data: direct } = await anon().from("votes").select("value").eq("user_id", u.id);
    expect(direct).toEqual([]);

    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { showVotes: true }))).status).toBe(200);
    const pub = await fetch(`${APP_URL}/api/users/${u.handle}/votes`);
    expect(pub.status).toBe(200);
    expect(((await pub.json()) as { items: { value: string }[] }).items[0]?.value).toBe("uses_ai");

    const stats = (await (await fetch(`${APP_URL}/api/users/${u.handle}`)).json()) as { stats: { votes: number } };
    expect(stats.stats.votes).toBe(1);
  });

  it("pages comment history", async () => {
    const u = await namedUser("talker");
    const mediaId = await publishedTitle(`it-cmt-${crypto.randomUUID().slice(0, 8)}`);
    for (let i = 0; i < 3; i++) {
      expect((await u.client.from("comments").insert({ media_id: mediaId, body: `comment ${i}` })).error).toBeNull();
    }
    const first = (await (await fetch(`${APP_URL}/api/users/${u.handle}/comments?limit=2`)).json()) as {
      items: { body: string }[];
      nextCursor: string | null;
    };
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (await (
      await fetch(`${APP_URL}/api/users/${u.handle}/comments?limit=2&cursor=${first.nextCursor}`)
    ).json()) as { items: { body: string }[]; nextCursor: string | null };
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((c) => c.body)).size).toBe(3);
  });
});

describe("PATCH /api/me", () => {
  it("needs a session and a same-site origin", async () => {
    expect((await fetch(`${APP_URL}/api/me`, json(null, { showVotes: true }))).status).toBe(401);
    const u = await namedUser("origin");
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { showVotes: true }, "https://evil.example"))).status).toBe(403);
  });

  it("validates input and rejects unknown fields", async () => {
    const u = await namedUser("valid");
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { role: "admin" }))).status).toBe(422);
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { handle: "admin" }))).status).toBe(422);
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { avatarPath: "someone/x.webp" }))).status).toBe(422);
  });

  it("changes the username once, then enforces the 30-day rule", async () => {
    const u = await namedUser("renamer");
    const newHandle = `${u.handle.slice(0, 20)}_new`;
    const ok = await fetch(`${APP_URL}/api/me`, json(u.cookie, { handle: newHandle, displayName: "Re Namer" }));
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { handle: string }).handle).toBe(newHandle);
    const again = await fetch(`${APP_URL}/api/me`, json(u.cookie, { handle: `${newHandle}2` }));
    expect(again.status).toBe(422);
    expect(((await again.json()) as { error: { message: string } }).error.message).toMatch(/30 days/);
  });

  it("refuses a taken username", async () => {
    const a = await namedUser("taken");
    const b = await namedUser("taker");
    const res = await fetch(`${APP_URL}/api/me`, json(b.cookie, { handle: a.handle }));
    expect(res.status).toBe(409);
  });
});

describe("avatars", () => {
  const png = () =>
    new Blob([Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=="), (ch) => ch.charCodeAt(0))], { type: "image/png" });

  it("lets users write only in their own folder, at most 3 files", async () => {
    const u = await namedUser("pic");
    const other = await namedUser("other");
    const bucket = u.client.storage.from("avatars");

    const foreign = await bucket.upload(`${other.id}/x.png`, png(), { contentType: "image/png" });
    expect(foreign.error).not.toBeNull();

    for (const n of ["a", "b", "c"]) {
      const { error } = await bucket.upload(`${u.id}/${n}.png`, png(), { contentType: "image/png" });
      expect(error).toBeNull();
    }
    const fourth = await bucket.upload(`${u.id}/d.png`, png(), { contentType: "image/png" });
    expect(fourth.error).not.toBeNull();

    const svg = await bucket.upload(`${u.id}/e.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
    expect(svg.error).not.toBeNull();
  });

  it("sets an avatar through the API and removes the old file", async () => {
    const u = await namedUser("swap");
    const bucket = u.client.storage.from("avatars");
    expect((await bucket.upload(`${u.id}/one.png`, png(), { contentType: "image/png" })).error).toBeNull();
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { avatarPath: `${u.id}/one.png` }))).status).toBe(200);
    expect((await bucket.upload(`${u.id}/two.png`, png(), { contentType: "image/png" })).error).toBeNull();
    expect((await fetch(`${APP_URL}/api/me`, json(u.cookie, { avatarPath: `${u.id}/two.png` }))).status).toBe(200);
    const { data } = await admin().storage.from("avatars").list(u.id);
    expect(data?.map((f) => f.name)).toEqual(["two.png"]);

    const pub = await fetch(`${SUPABASE_URL}/storage/v1/object/public/avatars/${u.id}/two.png`);
    expect(pub.status).toBe(200);
  });
});

describe("sign-up", () => {
  it("keeps the username chosen at sign-up and reports availability", async () => {
    const handle = `new_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const client = anon();
    expect((await client.rpc("handle_available", { p_handle: handle })).data).toBe(true);
    const { data, error } = await client.auth.signUp({
      email: `${handle}@example.test`,
      password: `pw-${crypto.randomUUID()}`,
      options: { data: { handle } },
    });
    expect(error).toBeNull();
    const { data: row } = await admin().from("profiles").select("handle").eq("id", data.user!.id).single();
    expect(row?.handle).toBe(handle);
    expect((await client.rpc("handle_available", { p_handle: handle })).data).toBe(false);
  });
});
